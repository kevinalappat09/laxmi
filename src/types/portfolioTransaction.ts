/**
 * @module portfolioTransaction
 * @description Defines PortfolioTransaction domain types and request DTOs.
 * @stability experimental
 */

export type PortfolioTransactionType = 'BUY' | 'SELL' | 'SIP' | 'REDEMPTION' | 'DIVIDEND'

export interface PortfolioTransaction {
    id: number
    portfolioAssetId: number
    transactionType: PortfolioTransactionType
    quantity: number
    pricePerUnit: number
    fees: number
    taxes: number
    currency: string
    transactionDate: string
    isDividendReinvestment: boolean
    /** Investment account (Zerodha, Groww, etc.) where this asset is held. Always set. */
    assetAccountId: number
    /** Bank/savings account the money was transferred from (BUY/SIP) or to (SELL/REDEMPTION).
     *  null = direct transaction with no Laxmi account movement (ESOPs, employer grants, etc.) */
    sourceAccountId: number | null
    linkedRecurringId: number | null
    note: string | null
    isActive: boolean
    createdOn: string
    modifiedOn: string
}

/**
 * Provide exactly one of quantity or investedAmount:
 *   quantity       — unit-based entry (stocks, ETFs, ESOP grants)
 *   investedAmount — amount-based entry (mutual funds); service derives quantity = investedAmount / pricePerUnit
 *
 * assetAccountId: always required — the investment account (Zerodha, Groww) where this asset lives.
 * sourceAccountId: optional — the account the money came from (BUY/SIP) or goes to (SELL/REDEMPTION).
 *   null = direct transaction (no Laxmi account debit/credit needed).
 */
export interface CreatePortfolioTransactionRequest {
    portfolioAssetId: number
    transactionType: PortfolioTransactionType
    quantity?: number
    investedAmount?: number
    pricePerUnit: number
    fees?: number
    taxes?: number
    currency?: string
    transactionDate: Date
    isDividendReinvestment?: boolean
    assetAccountId: number
    sourceAccountId?: number | null
    linkedRecurringId?: number | null
    note?: string
}
