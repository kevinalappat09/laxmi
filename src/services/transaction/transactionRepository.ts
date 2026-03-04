/**
 * @module transactionRepository
 * @description Provides direct database access for Transaction entities.
 * @stability stable
 */

import { SQLiteDatabase } from "../../database/databaseService";
import {
    Transaction,
    TransactionType,
    Classification,
    TransactionReportQuery,
    ReportRow,
} from "../../types/transaction";

export interface TransactionRepository {
    save(transaction: Transaction): Transaction;
    findById(transactionId: number): Transaction | null;
    findByAccountId(accountId: number): Transaction[];
    delete(transactionId: number): void;
    findWithFilter(query: TransactionReportQuery): Transaction[];
    aggregate(query: TransactionReportQuery): ReportRow[];
}

export class TransactionRepositoryImpl implements TransactionRepository {
    constructor(private db: SQLiteDatabase) { }

    save(transaction: Transaction): Transaction {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const {
            transaction_id,
            account_id,
            transaction_date,
            transaction_type,
            amount,
            category_id,
            classification,
            note,
            transfer_account_id,
            is_active,
            created_on,
            modified_on,
        } = transaction;

        const transactionDateStr = this.dateToISOString(transaction_date, "date");
        const createdOnStr = this.dateToISOString(created_on, "timestamp");
        const modifiedOnStr = this.dateToISOString(modified_on, "timestamp");

        if (transaction_id) {
            const stmt = this.db.prepare(`
                UPDATE transactions
                SET account_id = ?,
                    transaction_date = ?,
                    transaction_type = ?,
                    amount = ?,
                    category_id = ?,
                    classification = ?,
                    note = ?,
                    transfer_account_id = ?,
                    is_active = ?,
                    modified_on = ?
                WHERE transaction_id = ?
            `);

            stmt.run(
                account_id,
                transactionDateStr,
                transaction_type,
                amount,
                category_id ?? null,
                classification,
                note ?? null,
                transfer_account_id ?? null,
                is_active ? 1 : 0,
                modifiedOnStr,
                transaction_id
            );

            return transaction;
        } else {
            // Insert new
            const stmt = this.db.prepare(`
                INSERT INTO transactions (
                    account_id,
                    transaction_date,
                    transaction_type,
                    amount,
                    category_id,
                    classification,
                    note,
                    transfer_account_id,
                    is_active,
                    created_on,
                    modified_on
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const result = stmt.run(
                account_id,
                transactionDateStr,
                transaction_type,
                amount,
                category_id ?? null,
                classification,
                note ?? null,
                transfer_account_id ?? null,
                is_active ? 1 : 0,
                createdOnStr,
                modifiedOnStr
            );

            return {
                ...transaction,
                transaction_id: result.lastInsertRowid as number,
            };
        }
    }

    findById(transactionId: number): Transaction | null {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            SELECT * FROM transactions WHERE transaction_id = ? AND is_active = 1
        `);

        const row = stmt.get(transactionId) as any;
        return row ? this.mapRowToTransaction(row) : null;
    }

    findByAccountId(accountId: number): Transaction[] {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            SELECT * FROM transactions 
            WHERE account_id = ? AND is_active = 1
            ORDER BY transaction_date DESC, transaction_id DESC
        `);

        const rows = stmt.all(accountId) as any[];
        return rows.map((row) => this.mapRowToTransaction(row));
    }

    delete(transactionId: number): void {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            UPDATE transactions 
            SET is_active = 0, modified_on = ?
            WHERE transaction_id = ?
        `);

        stmt.run(new Date().toISOString(), transactionId);
    }

    findWithFilter(query: TransactionReportQuery): Transaction[] {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        let sql = "SELECT * FROM transactions WHERE account_id = ? AND is_active = 1";
        const params: any[] = [query.accountId];

        if (query.fromDate) {
            sql += " AND transaction_date >= ?";
            params.push(this.dateToISOString(query.fromDate, "date"));
        }
        if (query.toDate) {
            sql += " AND transaction_date <= ?";
            params.push(this.dateToISOString(query.toDate, "date"));
        }

        if (query.types && query.types.size > 0) {
            const placeholders = Array(query.types.size).fill("?").join(",");
            sql += ` AND transaction_type IN (${placeholders})`;
            params.push(...Array.from(query.types));
        }

        if (query.categoryIds && query.categoryIds.size > 0) {
            const placeholders = Array(query.categoryIds.size).fill("?").join(",");
            sql += ` AND category_id IN (${placeholders})`;
            params.push(...Array.from(query.categoryIds));
        }

        if (query.classifications && query.classifications.size > 0) {
            const placeholders = Array(query.classifications.size).fill("?").join(",");
            sql += ` AND classification IN (${placeholders})`;
            params.push(...Array.from(query.classifications));
        }

        if (query.minAmount !== undefined) {
            sql += " AND amount >= ?";
            params.push(query.minAmount);
        }
        if (query.maxAmount !== undefined) {
            sql += " AND amount <= ?";
            params.push(query.maxAmount);
        }

        if (query.sort && query.sort.length > 0) {
            const orderClauses = query.sort.map((s) => `${s.field} ${s.direction}`);
            sql += ` ORDER BY ${orderClauses.join(", ")}`;
        } else {
            sql += " ORDER BY transaction_date DESC, transaction_id DESC";
        }

        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...params) as any[];
        return rows.map((row) => this.mapRowToTransaction(row));
    }

    aggregate(query: TransactionReportQuery): ReportRow[] {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const groupByFields = query.groupBy || [];
        const aggregateFunc = query.aggregateFunction || "SUM";

        let groupByClause = "";
        const selectFields: string[] = [];

        for (const field of groupByFields) {
            switch (field) {
                case "CATEGORY":
                    selectFields.push("category_id");
                    groupByClause += "category_id, ";
                    break;
                case "CLASSIFICATION":
                    selectFields.push("classification");
                    groupByClause += "classification, ";
                    break;
                case "TYPE":
                    selectFields.push("transaction_type");
                    groupByClause += "transaction_type, ";
                    break;
                case "MONTH":
                    selectFields.push("strftime('%Y-%m', transaction_date) as month");
                    groupByClause += "strftime('%Y-%m', transaction_date), ";
                    break;
                case "YEAR":
                    selectFields.push("strftime('%Y', transaction_date) as year");
                    groupByClause += "strftime('%Y', transaction_date), ";
                    break;
                case "DATE":
                    selectFields.push("transaction_date as date");
                    groupByClause += "transaction_date, ";
                    break;
            }
        }

        if (groupByClause.endsWith(", ")) {
            groupByClause = groupByClause.slice(0, -2);
        }

        const aggregateField =
            aggregateFunc === "SUM" ? "SUM(amount)" : "COUNT(*)";
        selectFields.push(`${aggregateField} as value`);

        let whereClause = "WHERE account_id = ? AND is_active = 1";
        const params: any[] = [query.accountId];

        if (query.fromDate) {
            whereClause += " AND transaction_date >= ?";
            params.push(this.dateToISOString(query.fromDate, "date"));
        }
        if (query.toDate) {
            whereClause += " AND transaction_date <= ?";
            params.push(this.dateToISOString(query.toDate, "date"));
        }

        if (query.types && query.types.size > 0) {
            const placeholders = Array(query.types.size).fill("?").join(",");
            whereClause += ` AND transaction_type IN (${placeholders})`;
            params.push(...Array.from(query.types));
        }

        if (query.categoryIds && query.categoryIds.size > 0) {
            const placeholders = Array(query.categoryIds.size).fill("?").join(",");
            whereClause += ` AND category_id IN (${placeholders})`;
            params.push(...Array.from(query.categoryIds));
        }

        if (query.classifications && query.classifications.size > 0) {
            const placeholders = Array(query.classifications.size).fill("?").join(",");
            whereClause += ` AND classification IN (${placeholders})`;
            params.push(...Array.from(query.classifications));
        }

        if (query.minAmount !== undefined) {
            whereClause += " AND amount >= ?";
            params.push(query.minAmount);
        }
        if (query.maxAmount !== undefined) {
            whereClause += " AND amount <= ?";
            params.push(query.maxAmount);
        }

        let sql = `SELECT ${selectFields.join(", ")} FROM transactions ${whereClause}`;

        if (groupByClause) {
            sql += ` GROUP BY ${groupByClause}`;
        }

        if (query.sort && query.sort.length > 0) {
            const orderClauses = query.sort.map((s) => `${s.field} ${s.direction}`);
            sql += ` ORDER BY ${orderClauses.join(", ")}`;
        } else {
            sql += " ORDER BY value DESC";
        }

        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...params) as any[];

        return rows.map((row) => {
            const reportRow: ReportRow = { value: row.value };

            for (const field of groupByFields) {
                switch (field) {
                    case "CATEGORY":
                        reportRow.category_id = row.category_id;
                        break;
                    case "CLASSIFICATION":
                        reportRow.classification = row.classification;
                        break;
                    case "TYPE":
                        reportRow.transaction_type = row.transaction_type;
                        break;
                    case "MONTH":
                        reportRow.month = row.month;
                        break;
                    case "YEAR":
                        reportRow.year = row.year;
                        break;
                    case "DATE":
                        reportRow.date = row.date;
                        break;
                }
            }

            return reportRow;
        });
    }

    private mapRowToTransaction(row: any): Transaction {
        return {
            transaction_id: row.transaction_id,
            account_id: row.account_id,
            transaction_date: new Date(row.transaction_date),
            transaction_type: row.transaction_type as TransactionType,
            amount: row.amount,
            category_id: row.category_id ?? undefined,
            classification: row.classification as Classification,
            note: row.note ?? undefined,
            transfer_account_id: row.transfer_account_id ?? undefined,
            is_active: row.is_active === 1,
            created_on: new Date(row.created_on),
            modified_on: new Date(row.modified_on),
        };
    }

    private dateToISOString(date: Date, format: "date" | "timestamp"): string {
        if (format === "date") {
            return date.toISOString().split("T")[0];
        } else {
            return date.toISOString();
        }
    }
}
