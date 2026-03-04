/**
 * @module category
 * @description Defines Category domain types and request/response DTOs.
 * @stability stable
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Category {
    category_id?: number;
    category_name: string;
    parent_category_id?: number;
    is_active: boolean;
    created_on: Date;
    modified_on: Date;
}

/* ------------------------------------------------------------------ */
/* Request/Response DTOs                                              */
/* ------------------------------------------------------------------ */

export interface CreateCategoryRequest {
    category_name: string;
    parent_category_id?: number;
}

export interface UpdateCategoryRequest {
    category_name?: string;
    parent_category_id?: number;
    is_active?: boolean;
}
