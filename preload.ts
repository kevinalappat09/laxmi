import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("financeAPI", {
    getLastOpenedProfile: (): Promise<string | null> =>
        ipcRenderer.invoke("get-last-opened-profile"),
    listProfiles: (): Promise<string[]> => ipcRenderer.invoke("list-profiles"),
    createProfile: (profileName: string): Promise<void> =>
        ipcRenderer.invoke("create-profile", profileName),
    openProfile: (profileName: string): Promise<void> =>
        ipcRenderer.invoke("open-profile", profileName)
})

contextBridge.exposeInMainWorld("environmentAPI", {
    getIsDev: (): Promise<boolean> => ipcRenderer.invoke("get-is-dev-status")
})