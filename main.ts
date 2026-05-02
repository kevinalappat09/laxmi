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
})

const accountService = new AccountServiceImpl()
const transactionService = new TransactionServiceImpl()
const categoryService = new CategoryServiceImpl()
const csvImportService = new TransactionImportServiceImpl()
const csvExportService = new TransactionExportServiceImpl()
const csvTemplateService = new CSVTemplateServiceImpl()
const csvErrorExportService = new CSVErrorExportServiceImpl()

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
