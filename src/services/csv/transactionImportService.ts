/**
 * @module transactionImportService
 * @description Orchestrates CSV file selection, preview, and transaction import.
 * @stability stable
 */

import fs from "fs";
import { dialog } from "electron";
import { Transaction, TransactionType } from "../../types/transaction";
import {
    CSVImportRequest,
    CSVImportResult,
    CSVPreviewResult,
    CSVRowError,
    CSVTransactionRow,
} from "../../types/csvImport";
import { TransactionRepositoryImpl } from "../transaction/transactionRepository";
import { CategoryServiceImpl } from "../category/categoryService";
import { profileSessionService } from "../profileSession/profileSessionService";
import { CSVParser } from "./csvParser";
import { MAX_CSV_FILE_BYTES, PREVIEW_ROW_COUNT } from "./csvLimits";

export interface TransactionImportService {
    openAndPreview(): Promise<CSVPreviewResult>;
    confirmImport(request: CSVImportRequest): CSVImportResult;
}

export class TransactionImportServiceImpl implements TransactionImportService {
    private pendingRows: CSVTransactionRow[] | null = null;
    private pendingEmptyCount: number = 0;
    private readonly csvParser = new CSVParser();
    private readonly categoryService = new CategoryServiceImpl();

    async openAndPreview(): Promise<CSVPreviewResult> {
        const empty: CSVPreviewResult = {
            cancelled: false,
            previewRows: [],
            totalDataRows: 0,
            emptyLineCount: 0,
        };

        const result = await dialog.showOpenDialog({
            title: "Select CSV file",
            filters: [{ name: "CSV Files", extensions: ["csv"] }],
            properties: ["openFile"],
        });

        if (result.canceled || result.filePaths.length === 0) {
            return { ...empty, cancelled: true };
        }

        const filePath = result.filePaths[0];

        let stat: fs.Stats;
        try {
            stat = fs.statSync(filePath);
        } catch {
            return { ...empty, error: "FILE_READ_ERROR" };
        }

        if (stat.size > MAX_CSV_FILE_BYTES) {
            return { ...empty, error: "FILE_TOO_LARGE" };
        }

        let raw: string;
        try {
            raw = fs.readFileSync(filePath, "utf-8");
        } catch {
            return { ...empty, error: "FILE_READ_ERROR" };
        }

        const { rows, emptyLineCount, truncated } = this.csvParser.parse(raw);

        if (truncated) {
            return { ...empty, error: "TOO_MANY_ROWS" };
        }

        this.pendingRows = rows;
        this.pendingEmptyCount = emptyLineCount;

        return {
            cancelled: false,
            previewRows: rows.slice(0, PREVIEW_ROW_COUNT),
            totalDataRows: rows.length,
            emptyLineCount,
        };
    }

    confirmImport(request: CSVImportRequest): CSVImportResult {
        if (this.pendingRows === null) {
            throw new Error("No CSV data pending. Call openAndPreview first.");
        }

        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const categoryNameMap = this.categoryService.getCategoryNameMap();
        const repository = new TransactionRepositoryImpl(db);
        const rows = this.pendingRows;
        const emptyLineCount = this.pendingEmptyCount;

        const failedRows: CSVRowError[] = [];
        let successCount = 0;

        const runImport = db.transaction(() => {
            for (const row of rows) {
                const validation = this.csvParser.validateRow(row, request.dateFormat);

                if (!validation.ok) {
                    failedRows.push({ rowNumber: row.rowNumber, rawLine: row.rawLine, reason: validation.error });
                    continue;
                }

                const categoryId = this.resolveCategoryId(row.category, categoryNameMap, row, failedRows);
                if (categoryId === false) {
                    continue;
                }

                const transactionType = this.deriveTransactionType(validation.amount, request.positiveAreDeposits);
                const absoluteAmount = Math.abs(validation.amount);

                const now = new Date();
                const transaction: Transaction = {
                    account_id: request.accountId,
                    transaction_date: validation.date,
                    transaction_type: transactionType,
                    amount: absoluteAmount,
                    category_id: categoryId ?? undefined,
                    classification: validation.classification,
                    payee: row.payee || undefined,
                    note: row.note || undefined,
                    is_active: true,
                    created_on: now,
                    modified_on: now,
                };

                repository.save(transaction);
                successCount++;
            }
        });

        runImport();

        this.pendingRows = null;
        this.pendingEmptyCount = 0;

        return { successCount, emptyLineCount, failedRows };
    }

    private resolveCategoryId(
        categoryName: string,
        map: Map<string, number>,
        row: CSVTransactionRow,
        failedRows: CSVRowError[]
    ): number | null | false {
        if (!categoryName) {
            return null;
        }

        const id = map.get(categoryName.toLowerCase());
        if (id === undefined) {
            failedRows.push({
                rowNumber: row.rowNumber,
                rawLine: row.rawLine,
                reason: `Unknown category "${categoryName}". Create the category first or leave the field blank.`,
            });
            return false;
        }

        return id;
    }

    private deriveTransactionType(amount: number, positiveAreDeposits: boolean): TransactionType {
        const isPositive = amount > 0;
        if (positiveAreDeposits) {
            return isPositive ? TransactionType.Deposit : TransactionType.Withdraw;
        } else {
            return isPositive ? TransactionType.Withdraw : TransactionType.Deposit;
        }
    }
}
