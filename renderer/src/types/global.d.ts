export { }

declare global {
    interface IFinanceAPI {
        getLastOpenedProfile: () => Promise<string | null>
        listProfiles: () => Promise<string[]>
        createProfile: (profileName: string) => Promise<void>
        openProfile: (profileName: string) => Promise<void>
    }

    interface Window {
        financeAPI: IFinanceAPI
    }
}
