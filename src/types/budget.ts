/**
 * @module budget
 * @description Defines Budget domain types, enums, and request/response DTOs.
 * @stability stable
 */

import { Classification } from "./transaction";

export enum BudgetType {
    Overall = "overall",
    Account = "account",
    Category = "category",
    Classification = "classification",
}

export enum BudgetPeriod {
    Monthly = "monthly",
    Yearly = "yearly",
}

export enum BudgetStatus {
    OnTrack = "on_track",
    Warning = "warning",
    OverBudget = "over_budget",
}

export interface Budget {
    budget_id?: number;
    name: string;
    budget_type: BudgetType;
    period: BudgetPeriod;
    amount: number;
    account_id?: number;
    category_id?: number;
    classification?: Classification;
    warning_threshold: number;
    is_active: boolean;
    created_on: Date;
    modified_on: Date;
}

export interface BudgetWithSpending extends Budget {
    spent: number;
    percentage: number;
    status: BudgetStatus;
    period_label: string;
    account_name?: string;
    category_name?: string;
}

export interface CreateBudgetRequest {
    name: string;
    budget_type: BudgetType;
    period: BudgetPeriod;
    amount: number;
    account_id?: number;
    category_id?: number;
    classification?: Classification;
    warning_threshold?: number;
}

export interface UpdateBudgetRequest {
    name?: string;
    budget_type?: BudgetType;
    period?: BudgetPeriod;
    amount?: number;
    account_id?: number;
    category_id?: number;
    classification?: Classification;
    warning_threshold?: number;
    is_active?: boolean;
}
