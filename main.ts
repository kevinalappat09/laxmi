import { app, BrowserWindow } from "electron"
import path from "path"

const isDev = !app.isPackaged

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
