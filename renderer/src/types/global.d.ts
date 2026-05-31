import {
    Account,
    CreateAccountRequest,
    UpdateAccountRequest,
} from "../../../src/types/account"
import {
    Transaction,
    CreateTransactionRequest,
    UpdateTransactionRequest,
    TransactionReportQuery,
} from "../../../src/types/transaction"
import {
    Category,
    CreateCategoryRequest,
    UpdateCategoryRequest,
} from "../../../src/types/category"
import {
    CSVImportRequest,
    CSVImportResult,
    CSVPreviewResult,
    CSVExportRequest,
    CSVExportResult,
    CSVTemplateResult,
    CSVExportErrorRowsResult,
} from "../../../src/types/csvImport"
import {
    Budget,
    BudgetWithSpending,
    CreateBudgetRequest,
    UpdateBudgetRequest,
} from "../../../src/types/budget"
import {
    CreateRecurringTransactionRequest,
    RecurringUpcomingNotification,
    RecurringTransaction,
    UpdateRecurringTransactionRequest,
} from "../../../src/types/recurringTransaction"

export {}

declare global {
    interface IFinanceAPI {
        // Profile management
        getLastOpenedProfile: () => Promise<string | null>
        listProfiles: () => Promise<string[]>
        createProfile: (profileName: string) => Promise<void>
        openProfile: (profileName: string) => Promise<void>

        // Account operations
        createAccount: (request: CreateAccountRequest) => Promise<Account>
        updateAccount: (
            accountId: number,
            request: UpdateAccountRequest
        ) => Promise<Account>
        deactivateAccount: (accountId: number) => Promise<void>
        getAccount: (accountId: number) => Promise<Account>
        listActiveAccounts: () => Promise<Account[]>

        // Transaction operations
        createTransaction: (request: CreateTransactionRequest) => Promise<Transaction>
        updateTransaction: (
            transactionId: number,
            request: UpdateTransactionRequest
        ) => Promise<Transaction>
        deleteTransaction: (transactionId: number) => Promise<void>
        getTransaction: (transactionId: number) => Promise<Transaction>
        getTransactionsByAccount: (accountId: number) => Promise<Transaction[]>
        findTransactionsWithFilter: (query: TransactionReportQuery) => Promise<Transaction[]>
        aggregateTransactions: (query: TransactionReportQuery) => Promise<any[]>

        // Category operations
        createCategory: (request: CreateCategoryRequest) => Promise<Category>
        updateCategory: (
            categoryId: number,
            request: UpdateCategoryRequest
        ) => Promise<Category>
        deactivateCategory: (categoryId: number) => Promise<void>
        getCategory: (categoryId: number) => Promise<Category>
        listActiveCategories: () => Promise<Category[]>
        getCategoriesByParent: (parentId: number) => Promise<Category[]>
        getRootCategories: () => Promise<Category[]>

        // Budget operations
        createBudget: (request: CreateBudgetRequest) => Promise<Budget>
        updateBudget: (budgetId: number, request: UpdateBudgetRequest) => Promise<Budget>
        deleteBudget: (budgetId: number) => Promise<void>
        listBudgetsWithSpending: (referenceDate?: Date) => Promise<BudgetWithSpending[]>
        getBudgetNotifications: (referenceDate?: Date) => Promise<BudgetWithSpending[]>

        // Recurring transaction operations
        createRecurring: (
            request: CreateRecurringTransactionRequest
        ) => Promise<RecurringTransaction>
        updateRecurring: (
            recurringId: number,
            request: UpdateRecurringTransactionRequest
        ) => Promise<RecurringTransaction>
        deleteRecurring: (recurringId: number) => Promise<void>
        listRecurring: () => Promise<RecurringTransaction[]>
        getUpcomingRecurring: (daysAhead?: number) => Promise<RecurringUpcomingNotification[]>

        csvOpenAndPreview: () => Promise<CSVPreviewResult>
        csvImportConfirm: (request: CSVImportRequest) => Promise<CSVImportResult>
        csvGenerateTemplate: () => Promise<CSVTemplateResult>
        csvExportTransactions: (request: CSVExportRequest) => Promise<CSVExportResult>
        csvExportErrorRows: (rawLines: string[]) => Promise<CSVExportErrorRowsResult>
    }

    interface Window {
        financeAPI: IFinanceAPI
        environmentAPI: {
            getIsDev: () => Promise<boolean>
        }
        windowAPI: {
            minimize: () => Promise<void>
            maximize: () => Promise<void>
            close: () => Promise<void>
            isMaximized: () => Promise<boolean>
        }
    }
}
