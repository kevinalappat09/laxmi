import { app, BrowserWindow, ipcMain } from "electron"
import path from "path"
import * as globalPreferencesService from "./src/services/globalPreferences/globalPreferencesService"
import * as profileService from "./src/services/profile/profileService"
import { MigrationService } from "./src/services/migration/migrationService"

const isDev = !app.isPackaged
const migrationService = new MigrationService(
    path.join(app.getAppPath(), "migrations")
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
