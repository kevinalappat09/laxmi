declare module 'xirr' {
    function xirr(cashFlows: { amount: number; when: Date }[]): number
    export = xirr
}
