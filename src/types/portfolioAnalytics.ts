/**
 * @module portfolioAnalytics
 * @description Defines analytics result types for the portfolio module.
 * @stability experimental
 */

import type { AssetCategory, AssetSubCategory, AssetType } from './portfolioAsset'

export interface AssetAnalytics {
    assetId: number
    name: string
    type: AssetType
    category: AssetCategory
    subCategory: AssetSubCategory | null
    totalUnits: number
    currentNav: number
    currentValue: number
    avco: number
    costBasis: number
    totalInvested: number       // all-time acquisition cost (fees included); stays high after partial sells
    unrealizedPl: number
    unrealizedPlPct: number
    realizedPl: number
    totalPl: number
    xirr: number | null
    cagr: number | null
    dayGainLoss: number | null
    dayGainLossPct: number | null
    allocationPct: number
    firstInvestmentDate: string
    lastUpdatedAt: string | null
}

export interface MonthlyInvestment {
    month: string    // 'YYYY-MM'
    amount: number   // sum of (quantity * price_per_unit) for BUY and SIP transactions
}

/** One point on the "portfolio value over time" dual-line chart */
export interface PortfolioValuePoint {
    date: string         // 'YYYY-MM-DD'
    invested: number     // cumulative amount invested up to this date
    currentValue: number // sum of (units_held × price) across all assets on this date
}

export interface PortfolioSummaryAnalytics {
    totalCurrentValue: number
    totalCostBasis: number
    totalInvested: number
    totalUnrealizedPl: number
    totalUnrealizedPlPct: number
    totalRealizedPl: number
    totalPl: number
    xirr: number | null
    dayGainLoss: number | null
    dayGainLossPct: number | null
    assets: AssetAnalytics[]
    allocation: AllocationBreakdown
    monthlyInvestments: MonthlyInvestment[]      // last 12 months bar chart
    portfolioValueHistory: PortfolioValuePoint[] // dual-line chart (invested vs current value)
    asOfDate: string
}

export interface AllocationBreakdown {
    byAsset:       { assetId: number; name: string; value: number; pct: number }[]
    byType:        { type: AssetType; value: number; pct: number }[]
    byCategory:    { category: AssetCategory; value: number; pct: number }[]
    bySubCategory: { subCategory: AssetSubCategory; value: number; pct: number }[]
}

/** Cash flow entry for XIRR calculation. Uses 'when' to match the xirr npm package's expected shape. */
export interface XirrCashFlow {
    amount: number
    when: Date
}

export interface MfSearchResult {
    schemeCode: string
    schemeName: string
}

export interface PriceRefreshResult {
    refreshedCount: number
    skippedCount: number
    failedAssets: { assetId: number; name: string; error: string }[]
    asOf: string
}
