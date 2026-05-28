import { contextBridge, ipcRenderer } from "electron"
import {
    CreateTransactionRequest,
    UpdateTransactionRequest,
    TransactionReportQuery,
    Transaction,
} from "./src/types/transaction"
import { CreateCategoryRequest, UpdateCategoryRequest, Category } from "./src/types/category"
import { Account } from "./src/types/account"
import {
    CSVImportRequest,
    CSVImportResult,
    CSVPreviewResult,
    CSVExportRequest,
    CSVExportResult,
    CSVTemplateResult,
    CSVExportErrorRowsResult,
} from "./src/types/csvImport"
import { Budget, BudgetWithSpending, CreateBudgetRequest, UpdateBudgetRequest } from "./src/types/budget"
import {
    CreateRecurringTransactionRequest,
    RecurringUpcomingNotification,
    RecurringTransaction,
    UpdateRecurringTransactionRequest,
} from "./src/types/recurringTransaction"

contextBridge.exposeInMainWorld("financeAPI", {
    // Profile management
    getLastOpenedProfile: (): Promise<string | null> =>
        ipcRenderer.invoke("get-last-opened-profile"),
    listProfiles: (): Promise<string[]> => ipcRenderer.invoke("list-profiles"),
    createProfile: (profileName: string): Promise<void> =>
        ipcRenderer.invoke("create-profile", profileName),
    openProfile: (profileName: string): Promise<void> =>
        ipcRenderer.invoke("open-profile", profileName),

    // Account operations
    createAccount: (request: any): Promise<Account> =>
        ipcRenderer.invoke("create-account", request),
    updateAccount: (accountId: number, request: any): Promise<Account> =>
        ipcRenderer.invoke("update-account", accountId, request),
    deactivateAccount: (accountId: number): Promise<void> =>
        ipcRenderer.invoke("deactivate-account", accountId),
    getAccount: (accountId: number): Promise<Account> =>
        ipcRenderer.invoke("get-account", accountId),
    listActiveAccounts: (): Promise<Account[]> =>
        ipcRenderer.invoke("list-active-accounts"),

    // Transaction operations
    createTransaction: (request: CreateTransactionRequest): Promise<Transaction> =>
        ipcRenderer.invoke("create-transaction", request),
    updateTransaction: (
        transactionId: number,
        request: UpdateTransactionRequest
    ): Promise<Transaction> =>
        ipcRenderer.invoke("update-transaction", transactionId, request),
    deleteTransaction: (transactionId: number): Promise<void> =>
        ipcRenderer.invoke("delete-transaction", transactionId),
    getTransaction: (transactionId: number): Promise<Transaction> =>
        ipcRenderer.invoke("get-transaction", transactionId),
    getTransactionsByAccount: (accountId: number): Promise<Transaction[]> =>
        ipcRenderer.invoke("get-transactions-by-account", accountId),
    findTransactionsWithFilter: (query: TransactionReportQuery): Promise<Transaction[]> =>
        ipcRenderer.invoke("find-transactions-with-filter", query),
    aggregateTransactions: (query: TransactionReportQuery): Promise<any[]> =>
        ipcRenderer.invoke("aggregate-transactions", query),

    // Category operations
    createCategory: (request: CreateCategoryRequest): Promise<Category> =>
        ipcRenderer.invoke("create-category", request),
    updateCategory: (
        categoryId: number,
        request: UpdateCategoryRequest
    ): Promise<Category> =>
        ipcRenderer.invoke("update-category", categoryId, request),
    deactivateCategory: (categoryId: number): Promise<void> =>
        ipcRenderer.invoke("deactivate-category", categoryId),
    getCategory: (categoryId: number): Promise<Category> =>
        ipcRenderer.invoke("get-category", categoryId),
    listActiveCategories: (): Promise<Category[]> =>
        ipcRenderer.invoke("list-active-categories"),
    getCategoriesByParent: (parentId: number): Promise<Category[]> =>
        ipcRenderer.invoke("get-categories-by-parent", parentId),
    getRootCategories: (): Promise<Category[]> =>
        ipcRenderer.invoke("get-root-categories"),

    // Budget operations
    createBudget: (request: CreateBudgetRequest): Promise<Budget> =>
        ipcRenderer.invoke("budget:create", request),
    updateBudget: (budgetId: number, request: UpdateBudgetRequest): Promise<Budget> =>
        ipcRenderer.invoke("budget:update", budgetId, request),
    deleteBudget: (budgetId: number): Promise<void> =>
        ipcRenderer.invoke("budget:delete", budgetId),
    listBudgetsWithSpending: (referenceDate?: Date): Promise<BudgetWithSpending[]> =>
        ipcRenderer.invoke("budget:list-with-spending", referenceDate),
    getBudgetNotifications: (referenceDate?: Date): Promise<BudgetWithSpending[]> =>
        ipcRenderer.invoke("budget:get-notifications", referenceDate),

    // Recurring transaction operations
    createRecurring: (request: CreateRecurringTransactionRequest): Promise<RecurringTransaction> =>
        ipcRenderer.invoke("recurring:create", request),
    updateRecurring: (
        recurringId: number,
        request: UpdateRecurringTransactionRequest
    ): Promise<RecurringTransaction> =>
        ipcRenderer.invoke("recurring:update", recurringId, request),
    deleteRecurring: (recurringId: number): Promise<void> =>
        ipcRenderer.invoke("recurring:delete", recurringId),
    listRecurring: (): Promise<RecurringTransaction[]> =>
        ipcRenderer.invoke("recurring:list"),
    getUpcomingRecurring: (daysAhead?: number): Promise<RecurringUpcomingNotification[]> =>
        ipcRenderer.invoke("recurring:get-upcoming", daysAhead),

    csvOpenAndPreview: (): Promise<CSVPreviewResult> =>
        ipcRenderer.invoke("csv-open-and-preview"),
    csvImportConfirm: (request: CSVImportRequest): Promise<CSVImportResult> =>
        ipcRenderer.invoke("csv-import-confirm", request),
    csvGenerateTemplate: (): Promise<CSVTemplateResult> =>
        ipcRenderer.invoke("csv-generate-template"),
    csvExportTransactions: (request: CSVExportRequest): Promise<CSVExportResult> =>
        ipcRenderer.invoke("csv-export-transactions", request),
    csvExportErrorRows: (rawLines: string[]): Promise<CSVExportErrorRowsResult> =>
        ipcRenderer.invoke("csv-export-error-rows", rawLines),
})

contextBridge.exposeInMainWorld("environmentAPI", {
    getIsDev: (): Promise<boolean> => ipcRenderer.invoke("get-is-dev-status")
})

contextBridge.exposeInMainWorld("windowAPI", {
    minimize: (): Promise<void> => ipcRenderer.invoke("window-minimize"),
    maximize: (): Promise<void> => ipcRenderer.invoke("window-maximize"),
    close: (): Promise<void> => ipcRenderer.invoke("window-close"),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke("window-is-maximized"),
})