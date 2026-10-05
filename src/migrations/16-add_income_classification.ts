import { SQLiteDatabase } from "../database/databaseService";

export function up(db: SQLiteDatabase): void {
    db.exec(`
        -- Temporarily clear the child references before rebuilding transactions.
        -- Keeping portfolio_transactions in place also preserves its dependent views.
        CREATE TEMP TABLE portfolio_transaction_links AS
        SELECT id, linked_transaction_id
        FROM portfolio_transactions
        WHERE linked_transaction_id IS NOT NULL;

        UPDATE portfolio_transactions SET linked_transaction_id = NULL;

        CREATE TABLE transactions_new (
            transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            transaction_date TEXT NOT NULL,
            transaction_type TEXT NOT NULL CHECK (
                transaction_type IN ('withdraw', 'deposit', 'transfer')
            ),
            amount DECIMAL NOT NULL CHECK (amount > 0),
            category_id INTEGER,
            classification TEXT NOT NULL CHECK (
                classification IN ('income', 'needs', 'wants', 'unnecessary', 'wasteful')
            ),
            note TEXT,
            transfer_account_id INTEGER,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_on TEXT NOT NULL,
            modified_on TEXT NOT NULL,
            payee TEXT,

            FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE RESTRICT,
            FOREIGN KEY (transfer_account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,

            CHECK (
                (transaction_type = 'deposit' AND classification = 'income')
                OR (transaction_type = 'withdraw' AND classification IN ('needs', 'wants', 'unnecessary', 'wasteful'))
                OR transaction_type = 'transfer'
            )
        );

        INSERT INTO transactions_new (
            transaction_id, account_id, transaction_date, transaction_type,
            amount, category_id, classification, note, transfer_account_id,
            is_active, created_on, modified_on, payee
        )
        SELECT
            transaction_id, account_id, transaction_date, transaction_type,
            amount, category_id,
            CASE WHEN transaction_type = 'deposit' THEN 'income' ELSE classification END,
            note, transfer_account_id, is_active, created_on, modified_on, payee
        FROM transactions;

        DROP TABLE transactions;
        ALTER TABLE transactions_new RENAME TO transactions;

        CREATE INDEX idx_transactions_account_date ON transactions(account_id, transaction_date);
        CREATE INDEX idx_transactions_category ON transactions(category_id);
        CREATE INDEX idx_transactions_type ON transactions(transaction_type);
        CREATE INDEX idx_transactions_classification ON transactions(classification);
        CREATE INDEX idx_transactions_is_active ON transactions(is_active);

        UPDATE portfolio_transactions
        SET linked_transaction_id = (
            SELECT linked_transaction_id
            FROM portfolio_transaction_links
            WHERE portfolio_transaction_links.id = portfolio_transactions.id
        )
        WHERE id IN (SELECT id FROM portfolio_transaction_links);

        DROP TABLE portfolio_transaction_links;

        CREATE TABLE recurring_transactions_new (
            recurring_id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER,
            transaction_type TEXT NOT NULL CHECK (
                transaction_type IN ('withdraw', 'deposit')
            ),
            amount REAL NOT NULL CHECK (amount > 0),
            category_id INTEGER,
            classification TEXT CHECK (
                classification IN ('income', 'needs', 'wants', 'unnecessary', 'wasteful')
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
            portfolio_asset_id INTEGER REFERENCES portfolio_assets(id),
            asset_account_id INTEGER REFERENCES accounts(account_id),

            FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE RESTRICT,

            CHECK (
                (frequency = 'weekly' AND day_of_week BETWEEN 0 AND 6 AND day_of_month IS NULL AND month_of_year IS NULL)
                OR (frequency = 'monthly' AND day_of_month BETWEEN 1 AND 31 AND day_of_week IS NULL AND month_of_year IS NULL)
                OR (frequency = 'yearly' AND day_of_month BETWEEN 1 AND 31 AND month_of_year BETWEEN 1 AND 12 AND day_of_week IS NULL)
            ),
            CHECK (
                (transaction_type = 'deposit' AND classification = 'income')
                OR (
                    transaction_type = 'withdraw'
                    AND (
                        classification IS NULL
                        OR classification IN ('needs', 'wants', 'unnecessary', 'wasteful')
                    )
                )
            )
        );

        INSERT INTO recurring_transactions_new (
            recurring_id, account_id, transaction_type, amount, category_id,
            classification, payee, note, frequency, day_of_week, day_of_month,
            month_of_year, start_date, last_processed_date, is_active,
            created_on, modified_on, portfolio_asset_id, asset_account_id
        )
        SELECT
            recurring_id, account_id, transaction_type, amount, category_id,
            CASE WHEN transaction_type = 'deposit' THEN 'income' ELSE classification END,
            payee, note, frequency, day_of_week, day_of_month, month_of_year,
            start_date, last_processed_date, is_active, created_on, modified_on,
            portfolio_asset_id, asset_account_id
        FROM recurring_transactions;

        DROP TABLE recurring_transactions;
        ALTER TABLE recurring_transactions_new RENAME TO recurring_transactions;

        CREATE INDEX idx_recurring_transactions_active ON recurring_transactions(is_active);
        CREATE INDEX idx_recurring_transactions_frequency ON recurring_transactions(frequency);
        CREATE INDEX idx_recurring_transactions_account ON recurring_transactions(account_id);
        CREATE INDEX idx_recurring_transactions_category ON recurring_transactions(category_id);
    `);
}
