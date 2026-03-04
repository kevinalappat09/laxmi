/**
 * @module categoryRepository.test
 * @description Unit tests for CategoryRepositoryImpl
 */

import Database from "better-sqlite3";
import { CategoryRepositoryImpl } from "./categoryRepository";
import { Category } from "../../types/category";

describe("CategoryRepositoryImpl", () => {
    let mockDb: Database.Database;
    let repository: CategoryRepositoryImpl;

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
                FOREIGN KEY (parent_category_id) REFERENCES categories(category_id) ON DELETE RESTRICT
            );
            
            CREATE INDEX idx_categories_parent ON categories(parent_category_id);
            CREATE INDEX idx_categories_active ON categories(is_active);
        `);

        mockDb.pragma("foreign_keys = ON");

        repository = new CategoryRepositoryImpl(mockDb as any);
    });

    afterEach(() => {
        mockDb.close();
    });

    describe("save", () => {
        it("should insert a new category and return with generated ID", () => {
            const category: Category = {
                category_name: "Groceries",
                is_active: true,
                created_on: new Date("2025-03-01T10:00:00Z"),
                modified_on: new Date("2025-03-01T10:00:00Z"),
            };

            const result = repository.save(category);

            expect(result.category_id).toBeDefined();
            expect(result.category_id).toBeGreaterThan(0);
            expect(result.category_name).toBe("Groceries");
        });

        it("should insert a category with a parent", () => {
            const parent: Category = {
                category_name: "Food",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            };

            const savedParent = repository.save(parent);

            const child: Category = {
                category_name: "Groceries",
                parent_category_id: savedParent.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            };

            const result = repository.save(child);

            expect(result.category_id).toBeDefined();
            expect(result.parent_category_id).toBe(savedParent.category_id);
        });

        it("should update an existing category", () => {
            const category: Category = {
                category_name: "Groceries",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            };

            const saved = repository.save(category);

            const updated: Category = {
                ...saved,
                category_name: "Grocery Shopping",
                modified_on: new Date(),
            };

            const result = repository.save(updated);

            expect(result.category_id).toBe(saved.category_id);
            expect(result.category_name).toBe("Grocery Shopping");
        });

        it("should handle null parent_category_id for root categories", () => {
            const category: Category = {
                category_name: "Root Category",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            };

            const result = repository.save(category);

            expect(result.parent_category_id).toBeUndefined();
        });
    });

    describe("findById", () => {
        it("should retrieve an active category by ID", () => {
            const category: Category = {
                category_name: "Groceries",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            };

            const saved = repository.save(category);
            const found = repository.findById(saved.category_id!);

            expect(found).not.toBeNull();
            expect(found?.category_id).toBe(saved.category_id);
            expect(found?.category_name).toBe("Groceries");
        });

        it("should return null for non-existent category", () => {
            const found = repository.findById(9999);
            expect(found).toBeNull();
        });

        it("should not return inactive categories", () => {
            const category: Category = {
                category_name: "Groceries",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            };

            const saved = repository.save(category);
            repository.deactivate(saved.category_id!);

            const found = repository.findById(saved.category_id!);
            expect(found).toBeNull();
        });
    });

    describe("findAll", () => {
        it("should retrieve all active categories ordered by name", () => {
            repository.save({
                category_name: "Zebra",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.save({
                category_name: "Apple",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.save({
                category_name: "Banana",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const results = repository.findAll();

            expect(results).toHaveLength(3);
            expect(results[0].category_name).toBe("Apple");
            expect(results[1].category_name).toBe("Banana");
            expect(results[2].category_name).toBe("Zebra");
        });

        it("should not return inactive categories", () => {
            const cat1 = repository.save({
                category_name: "Active",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const cat2 = repository.save({
                category_name: "Inactive",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.deactivate(cat2.category_id!);

            const results = repository.findAll();

            expect(results).toHaveLength(1);
            expect(results[0].category_id).toBe(cat1.category_id);
        });

        it("should return empty array if no active categories exist", () => {
            const results = repository.findAll();
            expect(results).toEqual([]);
        });
    });

    describe("findByParent", () => {
        it("should retrieve all active children of a parent category", () => {
            const parent = repository.save({
                category_name: "Food",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.save({
                category_name: "Groceries",
                parent_category_id: parent.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.save({
                category_name: "Dining",
                parent_category_id: parent.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.save({
                category_name: "Utilities",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const results = repository.findByParent(parent.category_id!);

            expect(results).toHaveLength(2);
            expect(results.every((c) => c.parent_category_id === parent.category_id)).toBe(true);
        });

        it("should not return inactive children", () => {
            const parent = repository.save({
                category_name: "Food",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const child1 = repository.save({
                category_name: "Groceries",
                parent_category_id: parent.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const child2 = repository.save({
                category_name: "Dining",
                parent_category_id: parent.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.deactivate(child2.category_id!);

            const results = repository.findByParent(parent.category_id!);

            expect(results).toHaveLength(1);
            expect(results[0].category_id).toBe(child1.category_id);
        });

        it("should return empty array if parent has no children", () => {
            const parent = repository.save({
                category_name: "Food",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const results = repository.findByParent(parent.category_id!);

            expect(results).toEqual([]);
        });

        it("should return empty array for non-existent parent", () => {
            const results = repository.findByParent(9999);
            expect(results).toEqual([]);
        });
    });

    describe("findRootCategories", () => {
        it("should retrieve all root categories (no parent)", () => {
            const root1 = repository.save({
                category_name: "Food",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const root2 = repository.save({
                category_name: "Utilities",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.save({
                category_name: "Groceries",
                parent_category_id: root1.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const results = repository.findRootCategories();

            expect(results).toHaveLength(2);
            expect(results.every((c) => c.parent_category_id === undefined)).toBe(true);
            expect(results.some((c) => c.category_id === root1.category_id)).toBe(true);
            expect(results.some((c) => c.category_id === root2.category_id)).toBe(true);
        });

        it("should not return inactive root categories", () => {
            const root1 = repository.save({
                category_name: "Food",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const root2 = repository.save({
                category_name: "Utilities",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.deactivate(root2.category_id!);

            const results = repository.findRootCategories();

            expect(results).toHaveLength(1);
            expect(results[0].category_id).toBe(root1.category_id);
        });

        it("should return empty array if no root categories exist", () => {
            const results = repository.findRootCategories();
            expect(results).toEqual([]);
        });
    });

    describe("deactivate", () => {
        it("should soft-delete a category", () => {
            const category = repository.save({
                category_name: "Groceries",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.deactivate(category.category_id!);

            const found = repository.findById(category.category_id!);
            expect(found).toBeNull();
        });

        it("should not affect child categories when parent is deactivated", () => {
            const parent = repository.save({
                category_name: "Food",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const child = repository.save({
                category_name: "Groceries",
                parent_category_id: parent.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.deactivate(parent.category_id!);

            const foundChild = repository.findById(child.category_id!);
            expect(foundChild).not.toBeNull();
            expect(foundChild?.parent_category_id).toBe(parent.category_id);
        });
    });

    describe("category hierarchy", () => {
        it("should support multi-level hierarchy", () => {
            const level1 = repository.save({
                category_name: "Living Expenses",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const level2 = repository.save({
                category_name: "Housing",
                parent_category_id: level1.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const level3 = repository.save({
                category_name: "Mortgage Payment",
                parent_category_id: level2.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const root = repository.findRootCategories();
            expect(root).toHaveLength(1);
            expect(root[0].category_id).toBe(level1.category_id);

            const children = repository.findByParent(level1.category_id!);
            expect(children).toHaveLength(1);
            expect(children[0].category_id).toBe(level2.category_id);

            const grandchildren = repository.findByParent(level2.category_id!);
            expect(grandchildren).toHaveLength(1);
            expect(grandchildren[0].category_id).toBe(level3.category_id);
        });

        it("should maintain parent_category_id after update", () => {
            const parent = repository.save({
                category_name: "Food",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const child = repository.save({
                category_name: "Groceries",
                parent_category_id: parent.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const updated: Category = {
                ...child,
                category_name: "Grocery Shopping",
            };

            repository.save(updated);

            const found = repository.findById(child.category_id!);
            expect(found?.parent_category_id).toBe(parent.category_id);
            expect(found?.category_name).toBe("Grocery Shopping");
        });
    });

    describe("getAllChildrenRecursive", () => {
        it("should return all direct and indirect children of a category", () => {
            const parent = repository.save({
                category_name: "Food",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const child1 = repository.save({
                category_name: "Groceries",
                parent_category_id: parent.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const child2 = repository.save({
                category_name: "Dining Out",
                parent_category_id: parent.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const grandchild = repository.save({
                category_name: "Organic Produce",
                parent_category_id: child1.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const children = repository.getAllChildrenRecursive(parent.category_id!);

            expect(children).toHaveLength(3);
            expect(children).toContain(child1.category_id);
            expect(children).toContain(child2.category_id);
            expect(children).toContain(grandchild.category_id);
        });

        it("should return empty array when category has no children", () => {
            const parent = repository.save({
                category_name: "Food",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const children = repository.getAllChildrenRecursive(parent.category_id!);

            expect(children).toHaveLength(0);
        });
    });

    describe("deactivateRecursive", () => {
        it("should deactivate a category and all its children recursively", () => {
            const parent = repository.save({
                category_name: "Food",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const child1 = repository.save({
                category_name: "Groceries",
                parent_category_id: parent.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const child2 = repository.save({
                category_name: "Dining Out",
                parent_category_id: parent.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const grandchild = repository.save({
                category_name: "Organic Produce",
                parent_category_id: child1.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.deactivateRecursive(parent.category_id!);

            expect(repository.findById(parent.category_id!)).toBeNull();
            expect(repository.findById(child1.category_id!)).toBeNull();
            expect(repository.findById(child2.category_id!)).toBeNull();
            expect(repository.findById(grandchild.category_id!)).toBeNull();
        });

        it("should only deactivate children of the specified parent, not other categories", () => {
            const parent1 = repository.save({
                category_name: "Food",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const parent2 = repository.save({
                category_name: "Transport",
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const child1 = repository.save({
                category_name: "Groceries",
                parent_category_id: parent1.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const child2 = repository.save({
                category_name: "Gas",
                parent_category_id: parent2.category_id,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.deactivateRecursive(parent1.category_id!);

            expect(repository.findById(parent1.category_id!)).toBeNull();
            expect(repository.findById(child1.category_id!)).toBeNull();
            expect(repository.findById(parent2.category_id!)).not.toBeNull();
            expect(repository.findById(child2.category_id!)).not.toBeNull();
        });
    });
});
