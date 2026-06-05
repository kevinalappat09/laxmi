import { SQLiteDatabase } from "../database/databaseService";

export function up(db: SQLiteDatabase): void {
    db.exec(`
        CREATE TABLE portfolio_assets (
            id                    INTEGER PRIMARY KEY AUTOINCREMENT,
            name                  TEXT NOT NULL,
            category              TEXT NOT NULL,
            type                  TEXT NOT NULL,
            sub_category          TEXT,
            price_source          TEXT,
            price_source_id       TEXT,
            current_price         REAL,
            last_price_updated_at TEXT,
            currency              TEXT NOT NULL DEFAULT 'INR',
            metadata              TEXT,
            is_active             INTEGER NOT NULL DEFAULT 1,
            created_on            TEXT NOT NULL,
            modified_on           TEXT NOT NULL
        );
        CREATE INDEX idx_portfolio_assets_type   ON portfolio_assets(type);
        CREATE INDEX idx_portfolio_assets_active ON portfolio_assets(is_active);
    `);
}
