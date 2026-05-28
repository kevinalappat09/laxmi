import { SQLiteDatabase } from "../database/databaseService";

export function up(db: SQLiteDatabase): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS recurring_transactions (
            recurring_id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            transaction_type TEXT NOT NULL CHECK (
                transaction_type IN ('withdraw', 'deposit')
            ),
            amount REAL NOT NULL CHECK (amount > 0),
            category_id INTEGER,
            classification TEXT NOT NULL CHECK (
                classification IN ('needs', 'wants', 'unnecessary', 'wasteful')
            ),
            payee TEXT,
            note TEXT,
            frequency TEXT NOT NULL CHECK (
                frequency IN ('weekly', 'monthly', 'yearly')
            ),
            day_of_week INTEGER,
            day_of_month INTEGER,
            month_of_year INTEGER,
            start_date TEXT NOT NULL,
            last_processed_date TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_on TEXT NOT NULL,
            modified_on TEXT NOT NULL,

            FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE RESTRICT,

            CHECK (
                (frequency = 'weekly' AND day_of_week BETWEEN 0 AND 6 AND day_of_month IS NULL AND month_of_year IS NULL)
                OR (frequency = 'monthly' AND day_of_month BETWEEN 1 AND 31 AND day_of_week IS NULL AND month_of_year IS NULL)
                OR (frequency = 'yearly' AND day_of_month BETWEEN 1 AND 31 AND month_of_year BETWEEN 1 AND 12 AND day_of_week IS NULL)
            )
        );

        CREATE INDEX IF NOT EXISTS idx_recurring_transactions_active ON recurring_transactions(is_active);
        CREATE INDEX IF NOT EXISTS idx_recurring_transactions_frequency ON recurring_transactions(frequency);
        CREATE INDEX IF NOT EXISTS idx_recurring_transactions_account ON recurring_transactions(account_id);
        CREATE INDEX IF NOT EXISTS idx_recurring_transactions_category ON recurring_transactions(category_id);
    `);
}
