import { SQLiteDatabase } from "../database/databaseService";

export function up(db: SQLiteDatabase): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
            account_id INTEGER PRIMARY KEY AUTOINCREMENT,
            institution_name TEXT NOT NULL,
            account_name TEXT NOT NULL,
            account_type TEXT NOT NULL,
            sub_type TEXT NOT NULL,
            color TEXT NOT NULL,
            opened_on TEXT NOT NULL,
            created_on TEXT NOT NULL,
            modified_on TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1
        );

        CREATE INDEX IF NOT EXISTS idx_accounts_is_active ON accounts(is_active);
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL REFERENCES accounts(account_id),
            is_active INTEGER NOT NULL DEFAULT 1
        );
    `);
}
