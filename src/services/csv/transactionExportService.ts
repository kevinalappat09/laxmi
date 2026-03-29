/**
 * @module transactionExportService
 * @description Exports account transactions to a user-chosen CSV file.
 * @stability stable
 */

import fs from "fs";
import path from "path";
import { dialog } from "electron";
import { CSVExportRequest, CSVExportResult } from "../../types/csvImport";
import { TransactionRepositoryImpl } from "../transaction/transactionRepository";
import { profileSessionService } from "../profileSession/profileSessionService";
import { CSVParser } from "./csvParser";

export interface TransactionExportService {
    exportToCSV(request: CSVExportRequest): Promise<CSVExportResult>;
}

export class TransactionExportServiceImpl implements TransactionExportService {
    private readonly csvParser = new CSVParser();

    async exportToCSV(request: CSVExportRequest): Promise<CSVExportResult> {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new TransactionRepositoryImpl(db);
        const transactions = repository.findByAccountId(request.accountId);

        const csvString = this.csvParser.serialise(transactions, request.positiveAreDeposits);

        const today = new Date().toISOString().split("T")[0];
        const defaultFilename = `transactions-${request.accountId}-${today}.csv`;

        const result = await dialog.showSaveDialog({
            title: "Export transactions",
            defaultPath: path.join(defaultFilename),
            filters: [{ name: "CSV Files", extensions: ["csv"] }],
        });

        if (result.canceled || !result.filePath) {
            return { cancelled: true };
        }

        fs.writeFileSync(result.filePath, csvString, "utf-8");

        return { cancelled: false, savedPath: result.filePath };
    }
}
