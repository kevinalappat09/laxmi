/**
 * @module creditCardRepository
 * @description Provides direct database access for credit card detail records.
 * @stability experimental
 */

import { SQLiteDatabase } from "../../database/databaseService";
import { CreditCardDetails } from "../../types/creditCard";

export interface CreditCardRepository {
    upsert(details: CreditCardDetails): CreditCardDetails;
    findByAccountId(accountId: number): CreditCardDetails | null;
    findAllActive(): CreditCardDetails[];
    deleteByAccountId(accountId: number): void;
}

export class CreditCardRepositoryImpl implements CreditCardRepository {
    constructor(private db: SQLiteDatabase) {}

    upsert(details: CreditCardDetails): CreditCardDetails {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const createdOnStr = details.created_on.toISOString();
        const modifiedOnStr = details.modified_on.toISOString();

        const stmt = this.db.prepare(`
            INSERT INTO credit_cards (
                account_id,
                credit_limit,
                statement_day,
                payment_due_day,
                utilization_alert_threshold,
                statement_reminder_lead_days,
                payment_reminder_lead_days,
                created_on,
                modified_on
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(account_id) DO UPDATE SET
                credit_limit = excluded.credit_limit,
                statement_day = excluded.statement_day,
                payment_due_day = excluded.payment_due_day,
                utilization_alert_threshold = excluded.utilization_alert_threshold,
                statement_reminder_lead_days = excluded.statement_reminder_lead_days,
                payment_reminder_lead_days = excluded.payment_reminder_lead_days,
                modified_on = excluded.modified_on
        `);

        stmt.run(
            details.account_id,
            details.credit_limit,
            details.statement_day,
            details.payment_due_day,
            details.utilization_alert_threshold,
            details.statement_reminder_lead_days,
            details.payment_reminder_lead_days,
            createdOnStr,
            modifiedOnStr
        );

        return details;
    }

    findByAccountId(accountId: number): CreditCardDetails | null {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const row = this.db
            .prepare(`SELECT * FROM credit_cards WHERE account_id = ?`)
            .get(accountId) as any;

        return row ? this.mapRow(row) : null;
    }

    findAllActive(): CreditCardDetails[] {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const rows = this.db
            .prepare(`
                SELECT cc.*
                FROM credit_cards cc
                JOIN accounts a ON a.account_id = cc.account_id
                WHERE a.is_active = 1 AND a.sub_type = 'credit'
                ORDER BY cc.account_id
            `)
            .all() as any[];

        return rows.map((row) => this.mapRow(row));
    }

    deleteByAccountId(accountId: number): void {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        this.db.prepare(`DELETE FROM credit_cards WHERE account_id = ?`).run(accountId);
    }

    private mapRow(row: any): CreditCardDetails {
        return {
            account_id: row.account_id,
            credit_limit: row.credit_limit,
            statement_day: row.statement_day,
            payment_due_day: row.payment_due_day,
            utilization_alert_threshold: row.utilization_alert_threshold,
            statement_reminder_lead_days: row.statement_reminder_lead_days,
            payment_reminder_lead_days: row.payment_reminder_lead_days,
            created_on: new Date(row.created_on),
            modified_on: new Date(row.modified_on),
        };
    }
}
