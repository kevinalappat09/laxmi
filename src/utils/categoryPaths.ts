import type { Category } from "../types/category";

export const CATEGORY_PATH_SEPARATOR = ":";

export function buildCategoryPathMap(categories: Category[]): Map<number, string> {
    const categoriesById = new Map<number, Category>();
    for (const category of categories) {
        if (category.category_id !== undefined) {
            categoriesById.set(category.category_id, category);
        }
    }

    const paths = new Map<number, string>();
    const buildPath = (categoryId: number, ancestors: Set<number>): string => {
        const cached = paths.get(categoryId);
        if (cached !== undefined) {
            return cached;
        }

        const category = categoriesById.get(categoryId);
        if (!category) {
            return String(categoryId);
        }

        if (
            category.parent_category_id === undefined ||
            !categoriesById.has(category.parent_category_id) ||
            ancestors.has(category.parent_category_id)
        ) {
            paths.set(categoryId, category.category_name);
            return category.category_name;
        }

        const nextAncestors = new Set(ancestors);
        nextAncestors.add(categoryId);
        const parentPath = buildPath(category.parent_category_id, nextAncestors);
        const path = `${parentPath}${CATEGORY_PATH_SEPARATOR}${category.category_name}`;
        paths.set(categoryId, path);
        return path;
    };

    for (const categoryId of categoriesById.keys()) {
        buildPath(categoryId, new Set());
    }

    return paths;
}

export function buildCategoryPathLookup(categories: Category[]): Map<string, number> {
    const pathsById = buildCategoryPathMap(categories);
    const categoryIdsByPath = new Map<string, number>();

    for (const [categoryId, path] of pathsById) {
        categoryIdsByPath.set(path.toLowerCase(), categoryId);
    }

    return categoryIdsByPath;
}
