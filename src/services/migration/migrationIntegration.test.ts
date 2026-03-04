import Database from "better-sqlite3";
import path from "path";
import {
    openDatabase,
    initializeSchema,
    getCurrentSchemaVersion,
} from "../../database/databaseService";
import { MigrationService } from "./migrationService";

describe("Migration Integration Tests", () => {
    let db: Database.Database;
    const migrationsDir = path.join(__dirname, "../../migrations");

    afterEach(() => {
        if (db) {
            db.close();
        }
    });

    it("should create transactions table with all required columns", () => {
        db = new Database(":memory:");
        initializeSchema(db);

        const migrationService = new MigrationService(migrationsDir);
        migrationService.migrate(db);

        // Verify transactions table exists and has all columns
        const tableInfo = db
            .prepare("PRAGMA table_info(transactions)")
            .all() as any[];

        const columnNames = tableInfo.map((col) => col.name);

        expect(columnNames).toContain("transaction_id");
        expect(columnNames).toContain("account_id");
        expect(columnNames).toContain("transaction_date");
        expect(columnNames).toContain("transaction_type");
        expect(columnNames).toContain("amount");
        expect(columnNames).toContain("category_id");
        expect(columnNames).toContain("classification");
        expect(columnNames).toContain("note");
        expect(columnNames).toContain("transfer_account_id");
        expect(columnNames).toContain("is_active");
        expect(columnNames).toContain("created_on");
        expect(columnNames).toContain("modified_on");
    });

    it("should create categories table with all required columns", () => {
        db = new Database(":memory:");
        initializeSchema(db);

        const migrationService = new MigrationService(migrationsDir);
        migrationService.migrate(db);

        // Verify categories table exists and has all columns
        const tableInfo = db
            .prepare("PRAGMA table_info(categories)")
            .all() as any[];

        const columnNames = tableInfo.map((col) => col.name);

        expect(columnNames).toContain("category_id");
        expect(columnNames).toContain("category_name");
        expect(columnNames).toContain("parent_category_id");
        expect(columnNames).toContain("is_active");
        expect(columnNames).toContain("created_on");
        expect(columnNames).toContain("modified_on");
    });

    it("should create required indexes on transactions table", () => {
        db = new Database(":memory:");
        initializeSchema(db);

        const migrationService = new MigrationService(migrationsDir);
        migrationService.migrate(db);

        const indexes = db
            .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='transactions'")
            .all() as any[];

        const indexNames = indexes.map((idx) => idx.name);

        expect(indexNames).toContain("idx_transactions_account_date");
        expect(indexNames).toContain("idx_transactions_category");
        expect(indexNames).toContain("idx_transactions_type");
        expect(indexNames).toContain("idx_transactions_classification");
        expect(indexNames).toContain("idx_transactions_is_active");
    });

    it("should create required indexes on categories table", () => {
        db = new Database(":memory:");
        initializeSchema(db);

        const migrationService = new MigrationService(migrationsDir);
        migrationService.migrate(db);

        const indexes = db
            .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='categories'")
            .all() as any[];

        const indexNames = indexes.map((idx) => idx.name);

        expect(indexNames).toContain("idx_categories_parent");
        expect(indexNames).toContain("idx_categories_active");
    });

    it("should allow inserting valid transactions", () => {
        db = new Database(":memory:");
        initializeSchema(db);

        const migrationService = new MigrationService(migrationsDir);
        migrationService.migrate(db);

        // Create a test account first
        db.prepare(`
            INSERT INTO accounts (
                institution_name, account_name, account_type, sub_type, 
                color, opened_on, created_on, modified_on, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run("TestBank", "Checking", "Asset", "checking", "#000000", 
               "2024-01-01", "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z", 1);

        // Insert a valid transaction
        const result = db.prepare(`
            INSERT INTO transactions (
                account_id, transaction_date, transaction_type, amount,
                category_id, classification, note, transfer_account_id,
                is_active, created_on, modified_on
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            1, "2024-01-15", "withdraw", 100,
            null, "needs", "Grocery shopping", null,
            1, "2024-01-15T10:00:00Z", "2024-01-15T10:00:00Z"
        );

        expect(result.changes).toBe(1);

        // Verify the transaction was inserted
        const transaction = db.prepare("SELECT * FROM transactions WHERE transaction_id = ?").get(1) as any;
        expect(transaction).toBeDefined();
        expect(transaction.account_id).toBe(1);
        expect(transaction.amount).toBe(100);
        expect(transaction.classification).toBe("needs");
    });

    it("should allow inserting valid categories with hierarchy", () => {
        db = new Database(":memory:");
        initializeSchema(db);

        const migrationService = new MigrationService(migrationsDir);
        migrationService.migrate(db);

        // Insert root categories
        db.prepare(`
            INSERT INTO categories (category_name, parent_category_id, is_active, created_on, modified_on)
            VALUES (?, ?, ?, ?, ?)
        `).run("Food", null, 1, "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z");

        db.prepare(`
            INSERT INTO categories (category_name, parent_category_id, is_active, created_on, modified_on)
            VALUES (?, ?, ?, ?, ?)
        `).run("Utilities", null, 1, "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z");

        // Insert child categories
        db.prepare(`
            INSERT INTO categories (category_name, parent_category_id, is_active, created_on, modified_on)
            VALUES (?, ?, ?, ?, ?)
        `).run("Groceries", 1, 1, "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z");

        db.prepare(`
            INSERT INTO categories (category_name, parent_category_id, is_active, created_on, modified_on)
            VALUES (?, ?, ?, ?, ?)
        `).run("Restaurants", 1, 1, "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z");

        // Verify categories were inserted
        const rootCategories = db
            .prepare("SELECT * FROM categories WHERE parent_category_id IS NULL")
            .all() as any[];
        expect(rootCategories).toHaveLength(2);

        const childCategories = db
            .prepare("SELECT * FROM categories WHERE parent_category_id = 1")
            .all() as any[];
        expect(childCategories).toHaveLength(2);
    });

    it("should enforce schema version after migration", () => {
        db = new Database(":memory:");
        initializeSchema(db);

        const migrationService = new MigrationService(migrationsDir);
        migrationService.migrate(db);

        const version = getCurrentSchemaVersion(db);
        expect(version).toBe(3);
    });
});
