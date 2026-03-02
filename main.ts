import { app, BrowserWindow, ipcMain } from "electron"
import path from "path"
import * as globalPreferencesService from "./src/services/globalPreferences/globalPreferencesService"
import * as profileService from "./src/services/profile/profileService"
import { MigrationService } from "./src/services/migration/migrationService"
import { getRootDataDirectory } from "./src/services/path/pathService"
import { AccountServiceImpl } from "./src/services/account/accountService"
import { CreateAccountRequest, UpdateAccountRequest } from "./src/types/account"

const isDev = !app.isPackaged;

const migrationService = new MigrationService(
    path.join(getRootDataDirectory(), "migrations")
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

function createWindow(): void {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    if (isDev) {
        win.loadURL("http://localhost:5173")
    } else {
        win.loadFile(path.join(__dirname, "../renderer/dist/index.html"))
    }
}

app.whenReady().then(createWindow)
