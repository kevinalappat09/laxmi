/**
 * @module categoryRepository
 * @description Provides direct database access for Category entities.
 * @stability stable
 */

import { SQLiteDatabase } from "../../database/databaseService";
import { Category } from "../../types/category";

export interface CategoryRepository {
    save(category: Category): Category;
    findById(categoryId: number): Category | null;
    findAll(): Category[];
    findByParent(parentId: number): Category[];
    findRootCategories(): Category[];
    deactivate(categoryId: number): void;
}

export class CategoryRepositoryImpl implements CategoryRepository {
    constructor(private db: SQLiteDatabase) { }

    save(category: Category): Category {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const {
            category_id,
            category_name,
            parent_category_id,
            is_active,
            created_on,
            modified_on,
        } = category;

        const createdOnStr = this.dateToISOString(created_on, "timestamp");
        const modifiedOnStr = this.dateToISOString(modified_on, "timestamp");

        if (category_id) {
            const stmt = this.db.prepare(`
                UPDATE categories
                SET category_name = ?,
                    parent_category_id = ?,
                    is_active = ?,
                    modified_on = ?
                WHERE category_id = ?
            `);

            stmt.run(
                category_name,
                parent_category_id ?? null,
                is_active ? 1 : 0,
                modifiedOnStr,
                category_id
            );

            return category;
        } else {
            const stmt = this.db.prepare(`
                INSERT INTO categories (
                    category_name,
                    parent_category_id,
                    is_active,
                    created_on,
                    modified_on
                ) VALUES (?, ?, ?, ?, ?)
            `);

            const result = stmt.run(
                category_name,
                parent_category_id ?? null,
                is_active ? 1 : 0,
                createdOnStr,
                modifiedOnStr
            );

            return {
                ...category,
                category_id: result.lastInsertRowid as number,
            };
        }
    }

    findById(categoryId: number): Category | null {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            SELECT * FROM categories WHERE category_id = ? AND is_active = 1
        `);

        const row = stmt.get(categoryId) as any;
        return row ? this.mapRowToCategory(row) : null;
    }

    findAll(): Category[] {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            SELECT * FROM categories WHERE is_active = 1 ORDER BY category_name
        `);

        const rows = stmt.all() as any[];
        return rows.map((row) => this.mapRowToCategory(row));
    }

    findByParent(parentId: number): Category[] {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            SELECT * FROM categories 
            WHERE parent_category_id = ? AND is_active = 1
            ORDER BY category_name
        `);

        const rows = stmt.all(parentId) as any[];
        return rows.map((row) => this.mapRowToCategory(row));
    }

    findRootCategories(): Category[] {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            SELECT * FROM categories 
            WHERE parent_category_id IS NULL AND is_active = 1
            ORDER BY category_name
        `);

        const rows = stmt.all() as any[];
        return rows.map((row) => this.mapRowToCategory(row));
    }

    deactivate(categoryId: number): void {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            UPDATE categories 
            SET is_active = 0, modified_on = ?
            WHERE category_id = ?
        `);

        stmt.run(new Date().toISOString(), categoryId);
    }

    private mapRowToCategory(row: any): Category {
        return {
            category_id: row.category_id,
            category_name: row.category_name,
            parent_category_id: row.parent_category_id ?? undefined,
            is_active: row.is_active === 1,
            created_on: new Date(row.created_on),
            modified_on: new Date(row.modified_on),
        };
    }

    private dateToISOString(date: Date, format: "date" | "timestamp"): string {
        if (format === "date") {
            return date.toISOString().split("T")[0];
        } else {
            return date.toISOString();
        }
    }
}
