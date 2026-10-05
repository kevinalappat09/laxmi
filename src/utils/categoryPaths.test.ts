import { Category } from "../types/category";
import { buildCategoryPathLookup, buildCategoryPathMap } from "./categoryPaths";

function category(
    categoryId: number,
    categoryName: string,
    parentCategoryId?: number
): Category {
    const now = new Date("2026-01-01T00:00:00.000Z");
    return {
        category_id: categoryId,
        category_name: categoryName,
        parent_category_id: parentCategoryId,
        is_active: true,
        created_on: now,
        modified_on: now,
    };
}

describe("categoryPaths", () => {
    test("builds root, child, and full descendant paths", () => {
        const categories = [
            category(1, "Food"),
            category(2, "Groceries", 1),
            category(3, "Organic", 2),
        ];

        expect(buildCategoryPathMap(categories)).toEqual(new Map([
            [1, "Food"],
            [2, "Food:Groceries"],
            [3, "Food:Groceries:Organic"],
        ]));
    });

    test("creates a case-insensitive full-path lookup", () => {
        const categories = [category(1, "Food"), category(2, "Groceries", 1)];

        const lookup = buildCategoryPathLookup(categories);

        expect(lookup.get("food")).toBe(1);
        expect(lookup.get("food:groceries")).toBe(2);
        expect(lookup.has("groceries")).toBe(false);
    });

    test("falls back to the category name when a parent is missing", () => {
        expect(buildCategoryPathMap([category(2, "Groceries", 999)]).get(2)).toBe("Groceries");
    });

    test("does not recurse forever when category data contains a cycle", () => {
        const paths = buildCategoryPathMap([
            category(1, "One", 2),
            category(2, "Two", 1),
        ]);

        expect(paths.get(1)).toBeDefined();
        expect(paths.get(2)).toBeDefined();
    });
});
