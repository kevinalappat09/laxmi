import { SQLiteDatabase } from "../database/databaseService";

export function up(db: SQLiteDatabase): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
            category_id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_name TEXT NOT NULL UNIQUE,
            parent_category_id INTEGER,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_on TEXT NOT NULL,
            modified_on TEXT NOT NULL,
            
            FOREIGN KEY (parent_category_id) REFERENCES categories(category_id) ON DELETE RESTRICT
        );
        
        CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_category_id);
        CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
    `);
}
