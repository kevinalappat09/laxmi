import { SQLiteDatabase } from "../database/databaseService";

export function up(db: SQLiteDatabase): void {
    db.exec(`
        ALTER TABLE portfolio_transactions
        ADD COLUMN linked_transaction_id INTEGER REFERENCES transactions(transaction_id);
    `);
}
