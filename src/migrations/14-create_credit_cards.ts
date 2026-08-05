import { SQLiteDatabase } from "../database/databaseService";

export function up(db: SQLiteDatabase): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS credit_cards (
            account_id INTEGER PRIMARY KEY REFERENCES accounts(account_id) ON DELETE CASCADE,
            credit_limit REAL NOT NULL CHECK (credit_limit > 0),
            statement_day INTEGER NOT NULL CHECK (statement_day >= 1 AND statement_day <= 31),
            payment_due_day INTEGER NOT NULL CHECK (payment_due_day >= 1 AND payment_due_day <= 31),
            utilization_alert_threshold REAL NOT NULL DEFAULT 0.05 CHECK (utilization_alert_threshold > 0 AND utilization_alert_threshold <= 1),
            statement_reminder_lead_days INTEGER NOT NULL DEFAULT 5 CHECK (statement_reminder_lead_days >= 0),
            payment_reminder_lead_days INTEGER NOT NULL DEFAULT 5 CHECK (payment_reminder_lead_days >= 0),
            created_on TEXT NOT NULL,
            modified_on TEXT NOT NULL
        );
    `);
}
