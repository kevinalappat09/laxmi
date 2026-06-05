import { SQLiteDatabase } from "../database/databaseService";

export function up(db: SQLiteDatabase): void {
    db.exec(`ALTER TABLE recurring_transactions ADD COLUMN portfolio_asset_id INTEGER REFERENCES portfolio_assets(id)`);
    db.exec(`ALTER TABLE recurring_transactions ADD COLUMN asset_account_id INTEGER REFERENCES accounts(account_id)`);
}
