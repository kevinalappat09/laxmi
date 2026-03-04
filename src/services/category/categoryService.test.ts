jest.mock("../profileSession/profileSessionService");

import { CategoryServiceImpl } from "./categoryService";
import { profileSessionService } from "../profileSession/profileSessionService";
import Database from "better-sqlite3";

describe("CategoryServiceImpl", () => {
    let service: CategoryServiceImpl;
    let mockDb: any;

    beforeEach(() => {
        mockDb = new Database(":memory:");
        mockDb.exec(`
            CREATE TABLE categories (
                category_id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_name TEXT NOT NULL UNIQUE,
                parent_category_id INTEGER,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_on TEXT NOT NULL,
                modified_on TEXT NOT NULL,
                FOREIGN KEY (parent_category_id) REFERENCES categories(category_id)
            );

            CREATE TABLE transactions (
                transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER REFERENCES categories(category_id),
                is_active INTEGER NOT NULL DEFAULT 1
            );
        `);

        (profileSessionService.getDatabaseConnection as jest.Mock).mockReturnValue(mockDb);

        service = new CategoryServiceImpl();
    });

    afterEach(() => {
        mockDb.close();
        jest.clearAllMocks();
    });

    describe("createCategory", () => {
        test("creates a new category with valid data", () => {
            const request = {
                category_name: "Groceries",
            };

            const created = service.createCategory(request);

            expect(created.category_id).toBeGreaterThan(0);
            expect(created.category_name).toBe("Groceries");
            expect(created.is_active).toBe(true);
            expect(created.created_on).toBeDefined();
        });

        test("creates a category with a parent", () => {
            const parentRequest = {
                category_name: "Food",
            };
            const parentCategory = service.createCategory(parentRequest);

            const childRequest = {
                category_name: "Groceries",
                parent_category_id: parentCategory.category_id,
            };

            const created = service.createCategory(childRequest);

            expect(created.parent_category_id).toBe(parentCategory.category_id);
        });

        test("throws when category_name is empty", () => {
            const request = {
                category_name: "",
            };

            expect(() => service.createCategory(request)).toThrow(
                "category_name is required and cannot be empty"
            );
        });

        test("throws when category_name is whitespace only", () => {
            const request = {
                category_name: "   ",
            };

            expect(() => service.createCategory(request)).toThrow(
                "category_name is required and cannot be empty"
            );
        });

        test("throws for non-existent parent category", () => {
            const request = {
                category_name: "Test",
                parent_category_id: 9999,
            };

            expect(() => service.createCategory(request)).toThrow(
                "Parent category with ID 9999 does not exist"
            );
        });

        test("throws when no database connection", () => {
            (profileSessionService.getDatabaseConnection as jest.Mock).mockReturnValue(null);

            const request = {
                category_name: "Test",
            };

            expect(() => service.createCategory(request)).toThrow(
                "No active database connection"
            );
        });
    });

    describe("updateCategory", () => {
        let categoryId: number;

        beforeEach(() => {
            const stmt = mockDb.prepare(`
                INSERT INTO categories (category_name, is_active, created_on, modified_on)
                VALUES (?, ?, ?, ?)
            `);
            const result = stmt.run(
                "Groceries",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );
            categoryId = result.lastInsertRowid as number;
        });

        test("updates an existing category", () => {
            const request = {
                category_name: "Food Shopping",
            };

            const updated = service.updateCategory(categoryId, request);

            expect(updated.category_id).toBe(categoryId);
            expect(updated.category_name).toBe("Food Shopping");
        });

        test("throws when category not found", () => {
            const request = {
                category_name: "New Name",
            };

            expect(() => service.updateCategory(9999, request)).toThrow(
                "Category with ID 9999 not found"
            );
        });

        test("throws when updating with empty category_name", () => {
            const request = {
                category_name: "",
            };

            expect(() => service.updateCategory(categoryId, request)).toThrow(
                "category_name cannot be empty"
            );
        });

        test("throws when setting category as its own parent", () => {
            const request = {
                parent_category_id: categoryId,
            };

            expect(() => service.updateCategory(categoryId, request)).toThrow(
                "A category cannot be its own parent"
            );
        });

        test("throws when parent category does not exist", () => {
            const request = {
                parent_category_id: 9999,
            };

            expect(() => service.updateCategory(categoryId, request)).toThrow(
                "Parent category with ID 9999 does not exist"
            );
        });

        test("allows setting is_active to false", () => {
            const request = {
                is_active: false,
            };

            const updated = service.updateCategory(categoryId, request);

            expect(updated.is_active).toBe(false);
        });
    });

    describe("deactivateCategory", () => {
        let categoryId: number;

        beforeEach(() => {
            const stmt = mockDb.prepare(`
                INSERT INTO categories (category_name, is_active, created_on, modified_on)
                VALUES (?, ?, ?, ?)
            `);
            const result = stmt.run(
                "Groceries",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );
            categoryId = result.lastInsertRowid as number;
        });

        test("soft deletes a category", () => {
            service.deactivateCategory(categoryId);

            const stmt = mockDb.prepare(`SELECT is_active FROM categories WHERE category_id = ?`);
            const row = stmt.get(categoryId) as any;

            expect(row.is_active).toBe(0);
        });

        test("throws when category not found", () => {
            expect(() => service.deactivateCategory(9999)).toThrow(
                "Category with ID 9999 not found"
            );
        });
    });

    describe("getCategory", () => {
        let categoryId: number;

        beforeEach(() => {
            const stmt = mockDb.prepare(`
                INSERT INTO categories (category_name, is_active, created_on, modified_on)
                VALUES (?, ?, ?, ?)
            `);
            const result = stmt.run(
                "Groceries",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );
            categoryId = result.lastInsertRowid as number;
        });

        test("retrieves a category by ID", () => {
            const category = service.getCategory(categoryId);

            expect(category.category_id).toBe(categoryId);
            expect(category.category_name).toBe("Groceries");
            expect(category.is_active).toBe(true);
        });

        test("throws when category not found", () => {
            expect(() => service.getCategory(9999)).toThrow(
                "Category with ID 9999 not found"
            );
        });
    });

    describe("listActiveCategories", () => {
        beforeEach(() => {
            const stmt = mockDb.prepare(`
                INSERT INTO categories (category_name, is_active, created_on, modified_on)
                VALUES (?, ?, ?, ?)
            `);

            stmt.run(
                "Groceries",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );

            stmt.run(
                "Utilities",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );

            stmt.run(
                "Inactive Category",
                0,
                new Date().toISOString(),
                new Date().toISOString()
            );
        });

        test("lists all active categories", () => {
            const categories = service.listActiveCategories();

            expect(categories).toHaveLength(2);
            expect(categories.every((c) => c.is_active)).toBe(true);
        });

        test("returns empty array when no active categories", () => {
            mockDb.exec("DELETE FROM categories WHERE is_active = 1");

            const categories = service.listActiveCategories();

            expect(categories).toHaveLength(0);
        });
    });

    describe("getCategoriesByParent", () => {
        let parentId: number;

        beforeEach(() => {
            const parentStmt = mockDb.prepare(`
                INSERT INTO categories (category_name, is_active, created_on, modified_on)
                VALUES (?, ?, ?, ?)
            `);
            const parentResult = parentStmt.run(
                "Food",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );
            parentId = parentResult.lastInsertRowid as number;

            const childStmt = mockDb.prepare(`
                INSERT INTO categories (category_name, parent_category_id, is_active, created_on, modified_on)
                VALUES (?, ?, ?, ?, ?)
            `);

            childStmt.run(
                "Groceries",
                parentId,
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );

            childStmt.run(
                "Dining Out",
                parentId,
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );
        });

        test("retrieves child categories of a parent", () => {
            const categories = service.getCategoriesByParent(parentId);

            expect(categories).toHaveLength(2);
            expect(categories.every((c) => c.parent_category_id === parentId)).toBe(true);
        });

        test("throws when parent category not found", () => {
            expect(() => service.getCategoriesByParent(9999)).toThrow(
                "Parent category with ID 9999 not found"
            );
        });
    });

    describe("getRootCategories", () => {
        beforeEach(() => {
            const rootStmt = mockDb.prepare(`
                INSERT INTO categories (category_name, is_active, created_on, modified_on)
                VALUES (?, ?, ?, ?)
            `);

            const rootResult1 = rootStmt.run(
                "Food",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );
            const parentId = rootResult1.lastInsertRowid as number;

            rootStmt.run(
                "Transportation",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );

            const childStmt = mockDb.prepare(`
                INSERT INTO categories (category_name, parent_category_id, is_active, created_on, modified_on)
                VALUES (?, ?, ?, ?, ?)
            `);

            childStmt.run(
                "Groceries",
                parentId,
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );
        });

        test("retrieves only root categories (no parent)", () => {
            const categories = service.getRootCategories();

            expect(categories).toHaveLength(2);
            expect(categories.every((c) => c.parent_category_id === undefined)).toBe(true);
        });

        test("returns empty array when no root categories exist", () => {
            mockDb.exec("DELETE FROM categories WHERE parent_category_id IS NOT NULL");
            mockDb.exec("DELETE FROM categories WHERE parent_category_id IS NULL");

            const categories = service.getRootCategories();

            expect(categories).toHaveLength(0);
        });
    });

    describe("deactivateCategory - cascade to children", () => {
        test("should deactivate a category and all its children when parent is deactivated", () => {
            const parentRequest = {
                category_name: "Food",
            };
            const parent = service.createCategory(parentRequest);

            const child1Request = {
                category_name: "Groceries",
                parent_category_id: parent.category_id,
            };
            const child1 = service.createCategory(child1Request);

            const child2Request = {
                category_name: "Dining Out",
                parent_category_id: parent.category_id,
            };
            const child2 = service.createCategory(child2Request);

            const grandchildRequest = {
                category_name: "Organic Produce",
                parent_category_id: child1.category_id,
            };
            const grandchild = service.createCategory(grandchildRequest);

            service.deactivateCategory(parent.category_id!);

            expect(() => service.getCategory(parent.category_id!)).toThrow(
                `Category with ID ${parent.category_id} not found`
            );
            expect(() => service.getCategory(child1.category_id!)).toThrow(
                `Category with ID ${child1.category_id} not found`
            );
            expect(() => service.getCategory(child2.category_id!)).toThrow(
                `Category with ID ${child2.category_id} not found`
            );
            expect(() => service.getCategory(grandchild.category_id!)).toThrow(
                `Category with ID ${grandchild.category_id} not found`
            );
        });

        test("should only deactivate children of the specified parent", () => {
            const parent1Request = {
                category_name: "Food",
            };
            const parent1 = service.createCategory(parent1Request);

            const parent2Request = {
                category_name: "Transport",
            };
            const parent2 = service.createCategory(parent2Request);

            const child1Request = {
                category_name: "Groceries",
                parent_category_id: parent1.category_id,
            };
            const child1 = service.createCategory(child1Request);

            const child2Request = {
                category_name: "Gas",
                parent_category_id: parent2.category_id,
            };
            const child2 = service.createCategory(child2Request);

            service.deactivateCategory(parent1.category_id!);

            expect(() => service.getCategory(parent1.category_id!)).toThrow();
            expect(() => service.getCategory(child1.category_id!)).toThrow();
            expect(service.getCategory(parent2.category_id!)).toBeDefined();
            expect(service.getCategory(child2.category_id!)).toBeDefined();
        });
    });
});
