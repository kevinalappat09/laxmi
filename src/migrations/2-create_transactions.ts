import { SQLiteDatabase } from "../database/databaseService";

export function up(db: SQLiteDatabase): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            transaction_date TEXT NOT NULL,
            transaction_type TEXT NOT NULL CHECK(
                transaction_type IN ('withdraw', 'deposit', 'transfer')
            ),
            amount DECIMAL NOT NULL CHECK(amount > 0),
            category_id INTEGER,
            classification TEXT NOT NULL CHECK(
                classification IN ('needs', 'wants', 'unnecessary', 'wasteful')
            ),
            note TEXT,
            transfer_account_id INTEGER,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_on TEXT NOT NULL,
            modified_on TEXT NOT NULL,
            
            FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE RESTRICT,
            FOREIGN KEY (transfer_account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, transaction_date);
        CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
        CREATE INDEX IF NOT EXISTS idx_transactions_classification ON transactions(classification);
        CREATE INDEX IF NOT EXISTS idx_transactions_is_active ON transactions(is_active);
    `);
}
