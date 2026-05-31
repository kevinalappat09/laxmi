/**
 * @module recurringTransaction
 * @description Defines recurring transaction domain types and DTOs.
 * @stability stable
 */

import { Classification, TransactionType } from "./transaction";

export enum RecurringFrequency {
    Weekly = "weekly",
    Monthly = "monthly",
    Yearly = "yearly",
}

export interface RecurringTransaction {
    recurring_id?: number;
    account_id: number;
    transaction_type: TransactionType.Withdraw | TransactionType.Deposit;
    amount: number;
    category_id?: number;
    classification: Classification;
    payee?: string;
    note?: string;
    frequency: RecurringFrequency;
    day_of_week?: number;
    day_of_month?: number;
    month_of_year?: number;
    start_date: Date;
    last_processed_date?: Date;
    is_active: boolean;
    created_on: Date;
    modified_on: Date;
}

export interface CreateRecurringTransactionRequest {
    account_id: number;
    transaction_type: TransactionType.Withdraw | TransactionType.Deposit;
    amount: number;
    category_id?: number;
    classification: Classification;
    payee?: string;
    note?: string;
    frequency: RecurringFrequency;
    day_of_week?: number;
    day_of_month?: number;
    month_of_year?: number;
    start_date: Date;
}

export interface UpdateRecurringTransactionRequest {
    account_id?: number;
    transaction_type?: TransactionType.Withdraw | TransactionType.Deposit;
    amount?: number;
    category_id?: number;
    classification?: Classification;
    payee?: string;
    note?: string;
    frequency?: RecurringFrequency;
    day_of_week?: number;
    day_of_month?: number;
    month_of_year?: number;
    start_date?: Date;
    is_active?: boolean;
}

export interface RecurringUpcomingNotification {
    recurring: RecurringTransaction;
    next_due_date: Date;
    days_until_due: number;
}
