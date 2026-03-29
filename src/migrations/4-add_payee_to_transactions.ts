import { SQLiteDatabase } from "../database/databaseService";

export function up(db: SQLiteDatabase): void {
    db.exec(`
        ALTER TABLE transactions ADD COLUMN payee TEXT;
    `);
}
