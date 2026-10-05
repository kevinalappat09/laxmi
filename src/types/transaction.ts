/**
 * @module transaction
 * @description Defines Transaction domain types, enums, and request/response DTOs.
 * @stability stable
 */

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export enum TransactionType {
    Withdraw = "withdraw",
    Deposit = "deposit",
    Transfer = "transfer",
}

export enum Classification {
    Income = "income",
    Needs = "needs",
    Wants = "wants",
    Unnecessary = "unnecessary",
    Wasteful = "wasteful",
}

export const EXPENSE_CLASSIFICATIONS: readonly Classification[] = [
    Classification.Needs,
    Classification.Wants,
    Classification.Unnecessary,
    Classification.Wasteful,
];

export function isExpenseClassification(
    classification: Classification | undefined | null
): classification is Classification {
    return classification !== undefined
        && classification !== null
        && EXPENSE_CLASSIFICATIONS.includes(classification);
}

export function resolveTransactionClassification(
    transactionType: TransactionType,
    classification?: Classification | null
): Classification {
    if (transactionType === TransactionType.Deposit) {
        return Classification.Income;
    }

    if (transactionType === TransactionType.Withdraw) {
        if (!classification) {
            throw new Error("classification is required for withdrawals.");
        }
        if (!isExpenseClassification(classification)) {
            throw new Error("withdrawals must use an expense classification.");
        }
        return classification;
    }

    return classification ?? Classification.Needs;
}

export enum GroupByField {
    Category = "CATEGORY",
    Classification = "CLASSIFICATION",
    Type = "TYPE",
    Month = "MONTH",
    Year = "YEAR",
    Date = "DATE",
}

export enum AggregateFunction {
    Sum = "SUM",
    Count = "COUNT",
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Transaction {
    transaction_id?: number;
    account_id: number;
    transaction_date: Date;
    transaction_type: TransactionType;
    amount: number;
    category_id?: number;
    classification: Classification;
    payee?: string;
    note?: string;
    transfer_account_id?: number;
    is_active: boolean;
    created_on: Date;
    modified_on: Date;
}

export interface Sort {
    field: string;
    direction: "ASC" | "DESC";
}

export interface TransactionReportQuery {
    accountId: number;
    fromDate?: Date;
    toDate?: Date;
    types?: Set<TransactionType>;
    categoryIds?: Set<number>;
    classifications?: Set<Classification>;
    minAmount?: number;
    maxAmount?: number;
    groupBy?: GroupByField[];
    aggregateFunction?: AggregateFunction;
    sort?: Sort[];
}

export interface ReportRow {
    [key: string]: any;
    value: number;
}

/* ------------------------------------------------------------------ */
/* Request/Response DTOs                                              */
/* ------------------------------------------------------------------ */

export interface CreateTransactionRequest {
    account_id: number;
    transaction_date: Date;
    transaction_type: TransactionType;
    amount: number;
    category_id?: number;
    /** Derived as Income for deposits; required for withdrawals. */
    classification?: Classification;
    payee?: string;
    note?: string;
    transfer_account_id?: number;
}

export interface UpdateTransactionRequest {
    transaction_date?: Date;
    transaction_type?: TransactionType;
    amount?: number;
    category_id?: number;
    classification?: Classification;
    payee?: string;
    note?: string;
    transfer_account_id?: number;
}
