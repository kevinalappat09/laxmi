import { SQLiteDatabase } from "../database/databaseService";

export function up(db: SQLiteDatabase): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS budgets (
            budget_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            budget_type TEXT NOT NULL CHECK (budget_type IN ('overall', 'account', 'category', 'classification')),
            period TEXT NOT NULL CHECK (period IN ('monthly', 'yearly')),
            amount REAL NOT NULL CHECK (amount > 0),
            account_id INTEGER REFERENCES accounts(account_id) ON DELETE RESTRICT,
            category_id INTEGER REFERENCES categories(category_id) ON DELETE RESTRICT,
            classification TEXT CHECK (classification IN ('needs', 'wants', 'unnecessary', 'wasteful')),
            warning_threshold REAL NOT NULL DEFAULT 0.8 CHECK (warning_threshold > 0 AND warning_threshold <= 1),
            is_active INTEGER NOT NULL DEFAULT 1,
            created_on TEXT NOT NULL,
            modified_on TEXT NOT NULL,

            CHECK (
                (budget_type = 'overall' AND account_id IS NULL AND category_id IS NULL AND classification IS NULL)
                OR (budget_type = 'account' AND account_id IS NOT NULL AND category_id IS NULL AND classification IS NULL)
                OR (budget_type = 'category' AND account_id IS NULL AND category_id IS NOT NULL AND classification IS NULL)
                OR (budget_type = 'classification' AND account_id IS NULL AND category_id IS NULL AND classification IS NOT NULL)
            )
        );

        CREATE INDEX IF NOT EXISTS idx_budgets_active ON budgets(is_active);
        CREATE INDEX IF NOT EXISTS idx_budgets_type ON budgets(budget_type);
        CREATE INDEX IF NOT EXISTS idx_budgets_account ON budgets(account_id);
        CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category_id);
    `);
}
