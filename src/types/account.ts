/**
 * @module account
 * @description Defines Account domain types, enums, and request/response DTOs.
 * @stability stable
 */

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export enum AccountType {
    Asset = "Asset",
    Liability = "Liability",
}

export enum AccountSubType {
    Savings = "savings",
    Checking = "checking",
    Salary = "salary",
    Credit = "credit",
    Investment = "investment",
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Account {
    account_id: number;
    institution_name: string;
    account_name: string;
    account_type: AccountType;
    sub_type: AccountSubType;
    color: string;
    opened_on: Date;
    created_on: Date;
    modified_on: Date;
    is_active: boolean;
}

export interface CreateAccountRequest {
    institution_name: string;
    account_name: string;
    account_type: AccountType;
    sub_type: AccountSubType;
    color: string;
    opened_on: Date;
}

export interface UpdateAccountRequest {
    institution_name?: string;
    account_name?: string;
    account_type?: AccountType;
    sub_type?: AccountSubType;
    color?: string;
    opened_on?: Date;
    is_active?: boolean;
}
