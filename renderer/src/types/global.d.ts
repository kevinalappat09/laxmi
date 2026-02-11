export { }

declare global {
    interface Window {
        financeAPI: {
            ping: () => string
        }
    }
}
