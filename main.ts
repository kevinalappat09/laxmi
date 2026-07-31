import { app, BrowserWindow, ipcMain, Menu } from "electron"
import { TransactionImportServiceImpl } from "./src/services/csv/transactionImportService"
import { TransactionExportServiceImpl } from "./src/services/csv/transactionExportService"
import { CSVTemplateServiceImpl } from "./src/services/csv/csvTemplateService"
import { CSVErrorExportServiceImpl } from "./src/services/csv/csvErrorExportService"
import { CSVImportRequest, CSVExportRequest } from "./src/types/csvImport"
import path from "path"
import * as globalPreferencesService from "./src/services/globalPreferences/globalPreferencesService"
import * as profileService from "./src/services/profile/profileService"
import { MigrationService } from "./src/services/migration/migrationService"
import { getRootDataDirectory } from "./src/services/path/pathService"
import { AccountServiceImpl } from "./src/services/account/accountService"
import { CreateAccountRequest, UpdateAccountRequest } from "./src/types/account"
import { TransactionServiceImpl } from "./src/services/transaction/transactionService"
import { CategoryServiceImpl } from "./src/services/category/categoryService"
import {
    CreateTransactionRequest,
    UpdateTransactionRequest,
    TransactionReportQuery,
} from "./src/types/transaction"
import { CreateCategoryRequest, UpdateCategoryRequest } from "./src/types/category"
import { BudgetServiceImpl } from "./src/services/budget/budgetService"
import { CreateBudgetRequest, UpdateBudgetRequest } from "./src/types/budget"
import { CreditCardServiceImpl } from "./src/services/creditCard/creditCardService"
import { CreateCreditCardRequest, UpdateCreditCardRequest } from "./src/types/creditCard"
import { RecurringTransactionServiceImpl } from "./src/services/recurringTransaction/recurringTransactionService"
import {
    CreateRecurringTransactionRequest,
    UpdateRecurringTransactionRequest,
} from "./src/types/recurringTransaction"
import { PortfolioAssetServiceImpl } from "./src/services/portfolio/portfolioAssetService"
import { PortfolioTransactionServiceImpl } from "./src/services/portfolio/portfolioTransactionService"
import { MfapiSearchServiceImpl } from "./src/services/portfolio/mfapiSearchService"
import { PriceUpdaterServiceImpl } from "./src/services/priceUpdater/priceUpdaterService"
import { PortfolioAnalyticsServiceImpl } from "./src/services/portfolioAnalytics/portfolioAnalyticsService"
import { CreatePortfolioAssetRequest, UpdatePortfolioAssetRequest } from "./src/types/portfolioAsset"
import { CreatePortfolioTransactionRequest } from "./src/types/portfolioTransaction"

const isDev = !app.isPackaged;

const migrationService = new MigrationService(
    path.join(__dirname, "src", "migrations")
)

ipcMain.handle("get-last-opened-profile", () =>
    globalPreferencesService.getLastOpenedProfile()
)

ipcMain.handle("list-profiles", () => profileService.listProfiles())

ipcMain.handle("create-profile", (_event, profileName: string) =>
    profileService.createProfile(profileName, migrationService)
)

ipcMain.handle("open-profile", async (_event, profileName: string) => {
    await profileService.openProfile(profileName, migrationService)
    recurringTransactionService.processRecurringTransactions()
        .catch(err => console.error('Background recurring processing error:', err))
    // Fire and forget — profile open must not block on network
    priceUpdaterService.refreshStaleAssets()
        .then(result => {
            if (result.failedAssets.length > 0) {
                console.warn('Price refresh partial failure:', result.failedAssets)
            }
        })
        .catch(err => console.error('Background price refresh error:', err))
})

const accountService = new AccountServiceImpl()
const transactionService = new TransactionServiceImpl()
const categoryService = new CategoryServiceImpl()
const budgetService = new BudgetServiceImpl()
const creditCardService = new CreditCardServiceImpl()
const recurringTransactionService = new RecurringTransactionServiceImpl()
const csvImportService = new TransactionImportServiceImpl()
const csvExportService = new TransactionExportServiceImpl()
const csvTemplateService = new CSVTemplateServiceImpl()
const csvErrorExportService = new CSVErrorExportServiceImpl()
const portfolioAssetService = new PortfolioAssetServiceImpl()
const portfolioTransactionService = new PortfolioTransactionServiceImpl()
const mfapiSearchService = new MfapiSearchServiceImpl()
const priceUpdaterService = new PriceUpdaterServiceImpl()
const portfolioAnalyticsService = new PortfolioAnalyticsServiceImpl()

ipcMain.handle("create-account", (_event, request: CreateAccountRequest) => {
    request.opened_on = new Date(request.opened_on)
    return accountService.createAccount(request)
})

ipcMain.handle("update-account", (_event, accountId: number, request: UpdateAccountRequest) => {
    if (request.opened_on) {
        request.opened_on = new Date(request.opened_on)
    }
    return accountService.updateAccount(accountId, request)
})

ipcMain.handle("deactivate-account", (_event, accountId: number) => {
    return accountService.deactivateAccount(accountId)
})

ipcMain.handle("get-account", (_event, accountId: number) => {
    return accountService.getAccount(accountId)
})

ipcMain.handle("list-active-accounts", () => {
    return accountService.listActiveAccounts()
})

ipcMain.handle("create-transaction", (_event, request: CreateTransactionRequest) => {
    request.transaction_date = new Date(request.transaction_date)
    return transactionService.createTransaction(request)
})

ipcMain.handle("update-transaction", (_event, transactionId: number, request: UpdateTransactionRequest) => {
    if (request.transaction_date) {
        request.transaction_date = new Date(request.transaction_date)
    }
    return transactionService.updateTransaction(transactionId, request)
})

ipcMain.handle("delete-transaction", (_event, transactionId: number) => {
    return transactionService.deleteTransaction(transactionId)
})

ipcMain.handle("get-transaction", (_event, transactionId: number) => {
    return transactionService.getTransaction(transactionId)
})

ipcMain.handle("get-transactions-by-account", (_event, accountId: number) => {
    return transactionService.getTransactionsByAccount(accountId)
})

ipcMain.handle("get-transactions-affecting-account", (_event, accountId: number) => {
    return transactionService.getTransactionsAffectingAccount(accountId)
})

ipcMain.handle("find-transactions-with-filter", (_event, query: TransactionReportQuery) => {
    if (query.fromDate) {
        query.fromDate = new Date(query.fromDate)
    }
    if (query.toDate) {
        query.toDate = new Date(query.toDate)
    }
    return transactionService.findWithFilter(query)
})

ipcMain.handle("aggregate-transactions", (_event, query: TransactionReportQuery) => {
    if (query.fromDate) {
        query.fromDate = new Date(query.fromDate)
    }
    if (query.toDate) {
        query.toDate = new Date(query.toDate)
    }
    return transactionService.aggregate(query)
})

ipcMain.handle("create-category", (_event, request: CreateCategoryRequest) => {
    return categoryService.createCategory(request)
})

ipcMain.handle("update-category", (_event, categoryId: number, request: UpdateCategoryRequest) => {
    return categoryService.updateCategory(categoryId, request)
})

ipcMain.handle("deactivate-category", (_event, categoryId: number) => {
    return categoryService.deactivateCategory(categoryId)
})

ipcMain.handle("get-category", (_event, categoryId: number) => {
    return categoryService.getCategory(categoryId)
})

ipcMain.handle("list-active-categories", () => {
    return categoryService.listActiveCategories()
})

ipcMain.handle("get-categories-by-parent", (_event, parentId: number) => {
    return categoryService.getCategoriesByParent(parentId)
})

ipcMain.handle("get-root-categories", () => {
    return categoryService.getRootCategories()
})

ipcMain.handle("budget:create", (_event, request: CreateBudgetRequest) => {
    return budgetService.createBudget(request)
})

ipcMain.handle("budget:update", (_event, budgetId: number, request: UpdateBudgetRequest) => {
    return budgetService.updateBudget(budgetId, request)
})

ipcMain.handle("budget:delete", (_event, budgetId: number) => {
    return budgetService.deactivateBudget(budgetId)
})

ipcMain.handle("budget:list-with-spending", (_event, referenceDate?: Date | string) => {
    const normalizedDate = referenceDate ? new Date(referenceDate) : undefined
    return budgetService.getActiveBudgetsWithSpending(normalizedDate)
})

ipcMain.handle("budget:get-notifications", (_event, referenceDate?: Date | string) => {
    const normalizedDate = referenceDate ? new Date(referenceDate) : undefined
    return budgetService.getNotifications(normalizedDate)
})

ipcMain.handle("creditcard:upsert", (_event, accountId: number, request: CreateCreditCardRequest | UpdateCreditCardRequest) => {
    return creditCardService.upsertCreditCardDetails(accountId, request)
})

ipcMain.handle("creditcard:get", (_event, accountId: number) => {
    return creditCardService.getCreditCardDetails(accountId)
})

ipcMain.handle("creditcard:list-summaries", (_event, referenceDate?: Date | string) => {
    const normalizedDate = referenceDate ? new Date(referenceDate) : undefined
    return creditCardService.listCreditCardSummaries(normalizedDate)
})

ipcMain.handle("creditcard:get-notifications", (_event, referenceDate?: Date | string) => {
    const normalizedDate = referenceDate ? new Date(referenceDate) : undefined
    return creditCardService.getNotifications(normalizedDate)
})

ipcMain.handle("recurring:create", (_event, request: CreateRecurringTransactionRequest) => {
    request.start_date = new Date(request.start_date)
    return recurringTransactionService.createRecurringTransaction(request)
})

ipcMain.handle(
    "recurring:update",
    (_event, recurringId: number, request: UpdateRecurringTransactionRequest) => {
        if (request.start_date) {
            request.start_date = new Date(request.start_date)
        }
        return recurringTransactionService.updateRecurringTransaction(recurringId, request)
    }
)

ipcMain.handle("recurring:delete", (_event, recurringId: number) => {
    return recurringTransactionService.deactivateRecurringTransaction(recurringId)
})

ipcMain.handle("recurring:list", () => {
    return recurringTransactionService.listRecurringTransactions()
})

ipcMain.handle("recurring:get-upcoming", (_event, daysAhead?: number) => {
    return recurringTransactionService.getUpcomingNotifications(daysAhead)
})

ipcMain.handle("recurring:process", (_event, referenceDate?: Date | string) => {
    const normalizedDate = referenceDate ? new Date(referenceDate) : undefined
    return recurringTransactionService.processRecurringTransactions(normalizedDate)
})

ipcMain.handle("csv-open-and-preview", () => {
    return csvImportService.openAndPreview()
})

ipcMain.handle("csv-import-confirm", (_event, request: CSVImportRequest) => {
    return csvImportService.confirmImport(request)
})

ipcMain.handle("csv-generate-template", () => {
    return csvTemplateService.generateTemplate()
})

ipcMain.handle("csv-export-transactions", (_event, request: CSVExportRequest) => {
    return csvExportService.exportToCSV(request)
})

ipcMain.handle("csv-export-error-rows", (_event, rawLines: string[]) => {
    return csvErrorExportService.exportErrorRows(rawLines)
})

// Portfolio — Assets
ipcMain.handle("portfolio:asset:create", (_event, req: CreatePortfolioAssetRequest) =>
    portfolioAssetService.create(req)
)
ipcMain.handle("portfolio:asset:update", (_event, { id, request }: { id: number; request: UpdatePortfolioAssetRequest }) =>
    portfolioAssetService.update(id, request)
)
ipcMain.handle("portfolio:asset:deactivate", (_event, { id }: { id: number }) =>
    portfolioAssetService.deactivate(id)
)
ipcMain.handle("portfolio:asset:list", () =>
    portfolioAssetService.listActive()
)
ipcMain.handle("portfolio:asset:get", (_event, { id }: { id: number }) =>
    portfolioAssetService.getById(id)
)

// Portfolio — Fund discovery
ipcMain.handle("portfolio:mfapi:search", (_event, { query }: { query: string }) =>
    mfapiSearchService.search(query)
)
ipcMain.handle("portfolio:mfapi:getMeta", (_event, { schemeCode }: { schemeCode: string }) =>
    mfapiSearchService.getMeta(schemeCode)
)

// Portfolio — Transactions
ipcMain.handle("portfolio:transaction:create", (_event, req: CreatePortfolioTransactionRequest) => {
    req.transactionDate = new Date(req.transactionDate)
    return portfolioTransactionService.create(req)
})
ipcMain.handle("portfolio:transaction:deactivate", (_event, { id }: { id: number }) =>
    portfolioTransactionService.deactivate(id)
)
ipcMain.handle("portfolio:transaction:list-by-asset", (_event, { portfolioAssetId }: { portfolioAssetId: number }) =>
    portfolioTransactionService.listByAsset(portfolioAssetId)
)

// Portfolio — Analytics
ipcMain.handle("portfolio:analytics:summary",
    () => portfolioAnalyticsService.getPortfolioSummary()
)
ipcMain.handle("portfolio:analytics:asset",
    (_event, { assetId }: { assetId: number }) => portfolioAnalyticsService.getAssetAnalytics(assetId)
)
ipcMain.handle("portfolio:analytics:nav-history",
    (_event, { assetId, fromDate, toDate }: { assetId: number; fromDate: string; toDate: string }) =>
        portfolioAnalyticsService.getNavHistory(assetId, fromDate, toDate)
)
ipcMain.handle("portfolio:analytics:value-history",
    (_event, { fromDate }: { fromDate: string }) =>
        portfolioAnalyticsService.getPortfolioValueHistory(fromDate)
)
ipcMain.handle("portfolio:analytics:value-by-account",
    (_event, { accountId }: { accountId: number }) =>
        portfolioAnalyticsService.getValueByAccount(accountId)
)

// Portfolio — Prices
ipcMain.handle("portfolio:prices:refresh-all",
    () => priceUpdaterService.refreshAll()
)
ipcMain.handle("portfolio:prices:refresh-asset",
    (_event, { assetId }: { assetId: number }) => priceUpdaterService.refreshAsset(assetId)
)

function createWindow(): void {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    ipcMain.handle("window-minimize", () => win.minimize())
    ipcMain.handle("window-maximize", () => {
        if (win.isMaximized()) {
            win.unmaximize()
        } else {
            win.maximize()
        }
    })
    ipcMain.handle("window-close", () => win.close())
    ipcMain.handle("window-is-maximized", () => win.isMaximized())

    if (isDev) {
        win.loadURL("http://localhost:5173")
    } else {
        win.loadFile(path.join(__dirname, "../renderer/dist/index.html"))
    }
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    createWindow()
})
