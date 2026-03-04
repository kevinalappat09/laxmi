/**
 * @module categoryService
 * @description Orchestrates category business logic and persistence operations.
 * @stability stable
 */

import { Category, CreateCategoryRequest, UpdateCategoryRequest } from "../../types/category";
import { CategoryRepositoryImpl } from "./categoryRepository";
import { profileSessionService } from "../profileSession/profileSessionService";

export interface CategoryService {
    createCategory(request: CreateCategoryRequest): Category;
    updateCategory(categoryId: number, request: UpdateCategoryRequest): Category;
    deactivateCategory(categoryId: number): void;
    getCategory(categoryId: number): Category;
    listActiveCategories(): Category[];
    getCategoriesByParent(parentId: number): Category[];
    getRootCategories(): Category[];
}

export class CategoryServiceImpl implements CategoryService {
    createCategory(request: CreateCategoryRequest): Category {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        this.validateCreateRequest(request, db);

        const now = new Date();
        const category: Category = {
            category_name: request.category_name,
            parent_category_id: request.parent_category_id,
            is_active: true,
            created_on: now,
            modified_on: now,
        };

        const repository = new CategoryRepositoryImpl(db);
        return repository.save(category);
    }

    updateCategory(categoryId: number, request: UpdateCategoryRequest): Category {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new CategoryRepositoryImpl(db);
        const existing = repository.findById(categoryId);

        if (!existing) {
            throw new Error(`Category with ID ${categoryId} not found.`);
        }

        this.validateUpdateRequest(categoryId, request, db);

        const updated: Category = {
            ...existing,
            category_name: request.category_name ?? existing.category_name,
            parent_category_id: request.parent_category_id !== undefined ? request.parent_category_id : existing.parent_category_id,
            is_active: request.is_active !== undefined ? request.is_active : existing.is_active,
            modified_on: new Date(),
        };

        return repository.save(updated);
    }

    deactivateCategory(categoryId: number): void {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new CategoryRepositoryImpl(db);
        const existing = repository.findById(categoryId);

        if (!existing) {
            throw new Error(`Category with ID ${categoryId} not found.`);
        }

        repository.deactivateRecursive(categoryId);
    }

    getCategory(categoryId: number): Category {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new CategoryRepositoryImpl(db);
        const category = repository.findById(categoryId);

        if (!category) {
            throw new Error(`Category with ID ${categoryId} not found.`);
        }

        return category;
    }

    listActiveCategories(): Category[] {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new CategoryRepositoryImpl(db);
        return repository.findAll();
    }

    getCategoriesByParent(parentId: number): Category[] {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new CategoryRepositoryImpl(db);
        const parentCategory = repository.findById(parentId);

        if (!parentCategory) {
            throw new Error(`Parent category with ID ${parentId} not found.`);
        }

        return repository.findByParent(parentId);
    }

    getRootCategories(): Category[] {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new CategoryRepositoryImpl(db);
        return repository.findRootCategories();
    }

    private validateCreateRequest(request: CreateCategoryRequest, db: any): void {
        if (!request.category_name || request.category_name.trim().length === 0) {
            throw new Error("category_name is required and cannot be empty.");
        }

        if (request.parent_category_id !== undefined && request.parent_category_id !== null) {
            this.validateParentCategoryExists(request.parent_category_id, db);
        }
    }

    private validateUpdateRequest(categoryId: number, request: UpdateCategoryRequest, db: any): void {
        if (request.category_name !== undefined && request.category_name.trim().length === 0) {
            throw new Error("category_name cannot be empty.");
        }

        if (request.parent_category_id !== undefined && request.parent_category_id !== null) {
            if (request.parent_category_id === categoryId) {
                throw new Error("A category cannot be its own parent.");
            }
            this.validateParentCategoryExists(request.parent_category_id, db);
        }
    }

    private validateParentCategoryExists(parentId: number, db: any): void {
        const repository = new CategoryRepositoryImpl(db);
        const parentCategory = repository.findById(parentId);
        if (!parentCategory) {
            throw new Error(`Parent category with ID ${parentId} does not exist.`);
        }
    }
}
