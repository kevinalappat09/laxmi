/**
 * @module portfolioAsset
 * @description Defines PortfolioAsset domain types, enums, and request DTOs.
 * @stability experimental
 */

export type AssetCategory = 'EQUITY' | 'DEBT'

// v1: EQUITY_MUTUAL_FUND and LIQUID_FUND only.
// STOCK and ETF are reserved for a future phase when Yahoo Finance integration is added.
export type AssetType = 'EQUITY_MUTUAL_FUND' | 'LIQUID_FUND' | 'STOCK' | 'ETF'

// Sub-categories for mutual funds — nullable (user may not specify one)
export type AssetSubCategory =
    | 'large_cap'
    | 'mid_cap'
    | 'small_cap'
    | 'flexi_cap'
    | 'index'
    | 'elss'
    | 'liquid'
    | 'debt'
    | 'hybrid'
    | 'international'

export type PriceSource = 'MFAPI' | 'YAHOO'

export interface PortfolioAsset {
    id: number
    name: string
    category: AssetCategory
    type: AssetType
    subCategory: AssetSubCategory | null
    priceSource: PriceSource | null
    priceSourceId: string | null
    currentPrice: number | null
    lastPriceUpdatedAt: string | null
    currency: string
    metadata: Record<string, unknown> | null
    isActive: boolean
    createdOn: string
    modifiedOn: string
}

export interface CreatePortfolioAssetRequest {
    name: string
    category: AssetCategory
    type: AssetType
    subCategory?: AssetSubCategory | null
    priceSource: PriceSource | null
    priceSourceId: string | null
    currency?: string
    metadata?: Record<string, unknown>
}

export interface UpdatePortfolioAssetRequest {
    name?: string
    subCategory?: AssetSubCategory | null
    priceSource?: PriceSource | null
    priceSourceId?: string | null
    metadata?: Record<string, unknown>
    isActive?: boolean
}
