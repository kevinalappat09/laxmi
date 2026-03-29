/**
 * @module csvParser
 * @description Parses, validates, serialises, and generates CSV data for transactions.
 * @stability stable
 */

import { Classification, Transaction, TransactionType } from "../../types/transaction";
import { CSVTransactionRow } from "../../types/csvImport";
import { MAX_IMPORT_ROWS } from "./csvLimits";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ValidationSuccess = {
    ok: true;
    date: Date;
    amount: number;
    classification: Classification;
};

export type ValidationFailure = {
    ok: false;
    error: string;
};

export type ValidationResult = ValidationSuccess | ValidationFailure;

/* ------------------------------------------------------------------ */
/* CSVParser                                                           */
/* ------------------------------------------------------------------ */

export class CSVParser {

    parse(raw: string): { rows: CSVTransactionRow[]; emptyLineCount: number; truncated: boolean } {
        const lines = raw.split(/\r?\n/);
        const rows: CSVTransactionRow[] = [];
        let emptyLineCount = 0;
        let truncated = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (this.isEmptyLine(line)) {
                emptyLineCount++;
                continue;
            }

            if (rows.length >= MAX_IMPORT_ROWS) {
                truncated = true;
                break;
            }

            const fields = this.splitCSVLine(line);
            rows.push({
                rowNumber: i + 1,
                rawLine: line,
                date: (fields[0] ?? "").trim(),
                payee: (fields[1] ?? "").trim(),
                amount: (fields[2] ?? "").trim(),
                category: (fields[3] ?? "").trim(),
                classification: (fields[4] ?? "").trim(),
                note: (fields[5] ?? "").trim(),
            });
        }

        return { rows, emptyLineCount, truncated };
    }

    validateRow(row: CSVTransactionRow, dateFormat: string): ValidationResult {
        const date = this.parseDate(row.date, dateFormat);
        if (!date) {
            return { ok: false, error: `Invalid date "${row.date}" — expected format ${dateFormat}.` };
        }

        const rawAmount = parseFloat(row.amount);
        if (isNaN(rawAmount) || rawAmount === 0) {
            return { ok: false, error: `Invalid amount "${row.amount}" — must be a non-zero decimal number.` };
        }

        const classification = this.parseClassification(row.classification);
        if (!classification) {
            return {
                ok: false,
                error: `Invalid classification "${row.classification}" — must be one of: needs, wants, unnecessary, wasteful.`,
            };
        }

        return { ok: true, date, amount: rawAmount, classification };
    }

    serialise(transactions: Transaction[], positiveAreDeposits: boolean): string {
        const lines: string[] = [];

        for (const tx of transactions) {
            const dateStr = this.formatDate(tx.transaction_date);

            let signedAmount: number;
            if (positiveAreDeposits) {
                signedAmount = tx.transaction_type === TransactionType.Deposit ? tx.amount : -tx.amount;
            } else {
                signedAmount = tx.transaction_type === TransactionType.Withdraw ? tx.amount : -tx.amount;
            }

            const fields = [
                dateStr,
                this.escapeField(tx.payee ?? ""),
                signedAmount.toString(),
                this.escapeField(""),
                tx.classification,
                this.escapeField(tx.note ?? ""),
            ];

            lines.push(fields.join(","));
        }

        return lines.join("\n");
    }

    generateTemplate(): string {
        const fields = [
            "25-03-2026",
            "Example Payee",
            "500.00",
            "Food",
            "needs",
            "Example note",
        ];
        return fields.join(",");
    }

    /* ------------------------------------------------------------------ */
    /* Private helpers                                                     */
    /* ------------------------------------------------------------------ */

    private isEmptyLine(line: string): boolean {
        return line.trim().length === 0 || this.splitCSVLine(line).every((f) => f.trim() === "");
    }

    private splitCSVLine(line: string): string[] {
        const fields: string[] = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];

            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === "," && !inQuotes) {
                fields.push(current);
                current = "";
            } else {
                current += ch;
            }
        }

        fields.push(current);
        return fields;
    }

    private parseDate(raw: string, dateFormat: string): Date | null {
        if (!raw) return null;

        if (dateFormat === "DD-MM-YYYY") {
            const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
            if (!match) return null;
            const [, dd, mm, yyyy] = match;
            const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
            if (isNaN(date.getTime())) return null;
            return date;
        }

        return null;
    }

    private formatDate(date: Date): string {
        const dd = String(date.getUTCDate()).padStart(2, "0");
        const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
        const yyyy = date.getUTCFullYear();
        return `${dd}-${mm}-${yyyy}`;
    }

    private parseClassification(raw: string): Classification | null {
        const normalised = raw.trim().toLowerCase();
        const valid: Classification[] = [
            Classification.Needs,
            Classification.Wants,
            Classification.Unnecessary,
            Classification.Wasteful,
        ];
        return valid.find((v) => v === normalised) ?? null;
    }

    private escapeField(value: string): string {
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }
}
