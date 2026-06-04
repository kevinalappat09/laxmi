import { SQLiteDatabase } from "../database/databaseService";

export function up(db: SQLiteDatabase): void {
    db.exec(`ALTER TABLE accounts ADD COLUMN metadata TEXT;`);
}
