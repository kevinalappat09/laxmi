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
    /** Source bank account to debit. Nullable — not required for direct portfolio SIPs. */
    account_id: number | null;
    transaction_type: TransactionType.Withdraw | TransactionType.Deposit;
    amount: number;
    category_id?: number;
    /** Nullable — not required for portfolio SIPs. */
    classification: Classification | null;
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
    /** When set, this recurring transaction is a portfolio SIP. */
    portfolio_asset_id?: number | null;
    /** Required when portfolio_asset_id is set — the investment account (Zerodha, Groww). */
    asset_account_id?: number | null;
}

export interface CreateRecurringTransactionRequest {
    /** Source bank account. Optional for portfolio SIPs. */
    account_id?: number | null;
    transaction_type: TransactionType.Withdraw | TransactionType.Deposit;
    amount: number;
    category_id?: number;
    /** Optional for portfolio SIPs. */
    classification?: Classification | null;
    payee?: string;
    note?: string;
    frequency: RecurringFrequency;
    day_of_week?: number;
    day_of_month?: number;
    month_of_year?: number;
    start_date: Date;
    portfolio_asset_id?: number | null;
    asset_account_id?: number | null;
}

export interface UpdateRecurringTransactionRequest {
    account_id?: number | null;
    transaction_type?: TransactionType.Withdraw | TransactionType.Deposit;
    amount?: number;
    category_id?: number;
    classification?: Classification | null;
    payee?: string;
    note?: string;
    frequency?: RecurringFrequency;
    day_of_week?: number;
    day_of_month?: number;
    month_of_year?: number;
    start_date?: Date;
    is_active?: boolean;
    portfolio_asset_id?: number | null;
    asset_account_id?: number | null;
}

export interface RecurringUpcomingNotification {
    recurring: RecurringTransaction;
    next_due_date: Date;
    days_until_due: number;
}
