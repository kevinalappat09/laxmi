import { SQLiteDatabase } from "../database/databaseService";

export function up(db: SQLiteDatabase): void {
    db.exec(`
        CREATE TABLE portfolio_price_history (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            portfolio_asset_id INTEGER NOT NULL,
            price              REAL NOT NULL,
            currency           TEXT NOT NULL DEFAULT 'INR',
            recorded_date      TEXT NOT NULL,
            created_on         TEXT NOT NULL,
            FOREIGN KEY(portfolio_asset_id) REFERENCES portfolio_assets(id)
        );

        CREATE UNIQUE INDEX idx_pph_asset_date ON portfolio_price_history(portfolio_asset_id, recorded_date);
        CREATE INDEX        idx_pph_asset      ON portfolio_price_history(portfolio_asset_id);
    `);
}
