import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("financeAPI", {
    getLastOpenedProfile: (): Promise<string | null> =>
        ipcRenderer.invoke("get-last-opened-profile"),
    listProfiles: (): Promise<string[]> => ipcRenderer.invoke("list-profiles"),
    createProfile: (profileName: string): Promise<void> =>
        ipcRenderer.invoke("create-profile", profileName),
    openProfile: (profileName: string): Promise<void> =>
        ipcRenderer.invoke("open-profile", profileName),
    createAccount: (request: any) =>
        ipcRenderer.invoke("create-account", request),
    updateAccount: (accountId: number, request: any) =>
        ipcRenderer.invoke("update-account", accountId, request),
    deactivateAccount: (accountId: number) =>
        ipcRenderer.invoke("deactivate-account", accountId),
    getAccount: (accountId: number) =>
        ipcRenderer.invoke("get-account", accountId),
    listActiveAccounts: (): Promise<any[]> =>
        ipcRenderer.invoke("list-active-accounts")
})

contextBridge.exposeInMainWorld("environmentAPI", {
    getIsDev: (): Promise<boolean> => ipcRenderer.invoke("get-is-dev-status")
})