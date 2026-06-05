/**
 * @module recurringTransactionRepository
 * @description Provides direct database access for RecurringTransaction entities.
 * @stability stable
 */

import { SQLiteDatabase } from "../../database/databaseService";
import {
    RecurringFrequency,
    RecurringTransaction,
} from "../../types/recurringTransaction";
import { Classification, TransactionType } from "../../types/transaction";

export interface RecurringTransactionRepository {
    save(recurringTransaction: RecurringTransaction): RecurringTransaction;
    findById(recurringId: number): RecurringTransaction | null;
    findAllActive(): RecurringTransaction[];
    deactivate(recurringId: number): void;
    updateLastProcessedDate(recurringId: number, date: Date): void;
}

export class RecurringTransactionRepositoryImpl
    implements RecurringTransactionRepository
{
    constructor(private db: SQLiteDatabase) {}

    save(recurringTransaction: RecurringTransaction): RecurringTransaction {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const {
            recurring_id,
            account_id,
            transaction_type,
            amount,
            category_id,
            classification,
            payee,
            note,
            frequency,
            day_of_week,
            day_of_month,
            month_of_year,
            start_date,
            last_processed_date,
            is_active,
            created_on,
            modified_on,
            portfolio_asset_id,
            asset_account_id,
        } = recurringTransaction;

        const startDateStr = this.dateToISOString(start_date, "date");
        const lastProcessedDateStr = last_processed_date
            ? this.dateToISOString(last_processed_date, "date")
            : null;
        const createdOnStr = this.dateToISOString(created_on, "timestamp");
        const modifiedOnStr = this.dateToISOString(modified_on, "timestamp");

        if (recurring_id) {
            const stmt = this.db.prepare(`
                UPDATE recurring_transactions
                SET account_id = ?,
                    transaction_type = ?,
                    amount = ?,
                    category_id = ?,
                    classification = ?,
                    payee = ?,
                    note = ?,
                    frequency = ?,
                    day_of_week = ?,
                    day_of_month = ?,
                    month_of_year = ?,
                    start_date = ?,
                    last_processed_date = ?,
                    is_active = ?,
                    modified_on = ?,
                    portfolio_asset_id = ?,
                    asset_account_id = ?
                WHERE recurring_id = ?
            `);

            stmt.run(
                account_id ?? null,
                transaction_type,
                amount,
                category_id ?? null,
                classification ?? null,
                payee ?? null,
                note ?? null,
                frequency,
                day_of_week ?? null,
                day_of_month ?? null,
                month_of_year ?? null,
                startDateStr,
                lastProcessedDateStr,
                is_active ? 1 : 0,
                modifiedOnStr,
                portfolio_asset_id ?? null,
                asset_account_id ?? null,
                recurring_id
            );

            return recurringTransaction;
        }

        const stmt = this.db.prepare(`
            INSERT INTO recurring_transactions (
                account_id,
                transaction_type,
                amount,
                category_id,
                classification,
                payee,
                note,
                frequency,
                day_of_week,
                day_of_month,
                month_of_year,
                start_date,
                last_processed_date,
                is_active,
                created_on,
                modified_on,
                portfolio_asset_id,
                asset_account_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            account_id ?? null,
            transaction_type,
            amount,
            category_id ?? null,
            classification ?? null,
            payee ?? null,
            note ?? null,
            frequency,
            day_of_week ?? null,
            day_of_month ?? null,
            month_of_year ?? null,
            startDateStr,
            lastProcessedDateStr,
            is_active ? 1 : 0,
            createdOnStr,
            modifiedOnStr,
            portfolio_asset_id ?? null,
            asset_account_id ?? null
        );

        return {
            ...recurringTransaction,
            recurring_id: result.lastInsertRowid as number,
        };
    }

    findById(recurringId: number): RecurringTransaction | null {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            SELECT * FROM recurring_transactions
            WHERE recurring_id = ? AND is_active = 1
        `);

        const row = stmt.get(recurringId) as any;
        return row ? this.mapRowToRecurringTransaction(row) : null;
    }

    findAllActive(): RecurringTransaction[] {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            SELECT * FROM recurring_transactions
            WHERE is_active = 1
            ORDER BY recurring_id DESC
        `);

        const rows = stmt.all() as any[];
        return rows.map((row) => this.mapRowToRecurringTransaction(row));
    }

    deactivate(recurringId: number): void {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            UPDATE recurring_transactions
            SET is_active = 0, modified_on = ?
            WHERE recurring_id = ?
        `);

        stmt.run(new Date().toISOString(), recurringId);
    }

    updateLastProcessedDate(recurringId: number, date: Date): void {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            UPDATE recurring_transactions
            SET last_processed_date = ?, modified_on = ?
            WHERE recurring_id = ?
        `);

        stmt.run(
            this.dateToISOString(date, "date"),
            new Date().toISOString(),
            recurringId
        );
    }

    private mapRowToRecurringTransaction(row: any): RecurringTransaction {
        return {
            recurring_id: row.recurring_id,
            account_id: row.account_id ?? null,
            transaction_type: row.transaction_type as
                | TransactionType.Withdraw
                | TransactionType.Deposit,
            amount: row.amount,
            category_id: row.category_id ?? undefined,
            classification: (row.classification as Classification) ?? null,
            payee: row.payee ?? undefined,
            note: row.note ?? undefined,
            frequency: row.frequency as RecurringFrequency,
            day_of_week: row.day_of_week ?? undefined,
            day_of_month: row.day_of_month ?? undefined,
            month_of_year: row.month_of_year ?? undefined,
            start_date: new Date(row.start_date),
            last_processed_date: row.last_processed_date
                ? new Date(row.last_processed_date)
                : undefined,
            is_active: row.is_active === 1,
            created_on: new Date(row.created_on),
            modified_on: new Date(row.modified_on),
            portfolio_asset_id: row.portfolio_asset_id ?? null,
            asset_account_id: row.asset_account_id ?? null,
        };
    }

    private dateToISOString(date: Date, format: "date" | "timestamp"): string {
        if (format === "date") {
            return date.toISOString().split("T")[0];
        }
        return date.toISOString();
    }
}
