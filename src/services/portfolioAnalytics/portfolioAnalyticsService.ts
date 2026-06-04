/**
 * @module portfolioAnalyticsService
 * @description Computes portfolio analytics: AVCO, P&L, XIRR, CAGR, day gain/loss, allocation, charts.
 * @stability experimental
 */

import xirr = require('xirr')
import { profileSessionService } from '../profileSession/profileSessionService'
import { PortfolioAssetRepositoryImpl } from '../../repository/portfolioAsset/portfolioAssetRepository'
import { PortfolioTransactionRepositoryImpl } from '../../repository/portfolioTransaction/portfolioTransactionRepository'
import { PortfolioPriceRepositoryImpl } from '../../repository/portfolioPrice/portfolioPriceRepository'
import type { PortfolioTransaction } from '../../types/portfolioTransaction'
import type {
    AssetAnalytics,
    PortfolioSummaryAnalytics,
    AllocationBreakdown,
    MonthlyInvestment,
    PortfolioValuePoint,
    XirrCashFlow,
} from '../../types/portfolioAnalytics'
import type { AssetCategory, AssetSubCategory, AssetType } from '../../types/portfolioAsset'

/* ------------------------------------------------------------------ */
/* XIRR helpers                                                        */
/* ------------------------------------------------------------------ */

function safeXirr(flows: XirrCashFlow[]): number | null {
    if (flows.length < 2) return null
    try {
        const result = xirr(flows)
        return isFinite(result) ? result : null
    } catch {
        return null
    }
}

function mapTransactionToFlow(t: PortfolioTransaction): XirrCashFlow | null {
    if (['BUY', 'SIP'].includes(t.transactionType)) {
        return { amount: -(t.quantity * t.pricePerUnit + t.fees + t.taxes), when: new Date(t.transactionDate) }
    }
    if (['SELL', 'REDEMPTION'].includes(t.transactionType)) {
        return { amount: t.quantity * t.pricePerUnit - t.fees - t.taxes, when: new Date(t.transactionDate) }
    }
    if (t.transactionType === 'DIVIDEND' && !t.isDividendReinvestment) {
        return { amount: t.quantity * t.pricePerUnit, when: new Date(t.transactionDate) }
    }
    return null
}

function buildAssetFlows(
    assetId: number,
    transactions: PortfolioTransaction[],
    terminalValue: number
): XirrCashFlow[] {
    const flows = transactions
        .filter(t => t.portfolioAssetId === assetId && t.isActive)
        .map(mapTransactionToFlow)
        .filter((f): f is XirrCashFlow => f !== null)

    if (terminalValue > 0) {
        flows.push({ amount: terminalValue, when: new Date() })
    }
    return flows
}

function buildPortfolioFlows(
    transactions: PortfolioTransaction[],
    totalCurrentValue: number
): XirrCashFlow[] {
    const flows = transactions
        .filter(t => t.isActive)
        .map(mapTransactionToFlow)
        .filter((f): f is XirrCashFlow => f !== null)

    flows.push({ amount: totalCurrentValue, when: new Date() })
    return flows
}

/* ------------------------------------------------------------------ */
/* Interface                                                           */
/* ------------------------------------------------------------------ */

export interface PortfolioAnalyticsService {
    getPortfolioSummary(): PortfolioSummaryAnalytics
    getAssetAnalytics(assetId: number): AssetAnalytics
    getNavHistory(assetId: number, fromDate: string, toDate: string): { date: string; nav: number }[]
    getPortfolioValueHistory(fromDate: string): PortfolioValuePoint[]
}

/* ------------------------------------------------------------------ */
/* Implementation                                                      */
/* ------------------------------------------------------------------ */

export class PortfolioAnalyticsServiceImpl implements PortfolioAnalyticsService {

    getPortfolioSummary(): PortfolioSummaryAnalytics {
        const db = profileSessionService.getDatabaseConnection()
        if (!db) throw new Error('No active database connection. Open a profile first.')

        const txnRepo   = new PortfolioTransactionRepositoryImpl(db)
        const priceRepo = new PortfolioPriceRepositoryImpl(db)
        const assetRepo = new PortfolioAssetRepositoryImpl(db)

        const summaryRows    = txnRepo.getSummary()
        const allTransactions = txnRepo.listAll()
        const allAssets      = assetRepo.listActive()
        const now            = new Date()
        const todayISO       = now.toISOString().split('T')[0]

        const assetMap = new Map(allAssets.map(a => [a.id, a]))

        const assetAnalyticsList: AssetAnalytics[] = []
        let totalCurrentValue = 0
        let totalDayGainLoss  = 0
        let totalYesterdayValue = 0
        let hasDayData = false

        for (const row of summaryRows) {
            const asset         = assetMap.get(row.assetId)
            const currentNav    = row.currentPrice ?? 0
            const currentValue  = row.currentValue ?? 0
            const unrealizedPl  = row.unrealizedPl ?? 0
            const unrealizedPlPct = row.costBasis > 0 ? (unrealizedPl / row.costBasis) * 100 : 0

            const yesterdayNav = priceRepo.getLatestBefore(row.assetId, todayISO)
            let dayGainLoss: number | null = null
            let dayGainLossPct: number | null = null
            if (yesterdayNav !== null) {
                dayGainLoss    = row.totalUnits * (currentNav - yesterdayNav)
                dayGainLossPct = yesterdayNav !== 0 ? ((currentNav - yesterdayNav) / yesterdayNav) * 100 : null
                totalDayGainLoss   += dayGainLoss
                totalYesterdayValue += row.totalUnits * yesterdayNav
                hasDayData = true
            }

            const assetTxns = allTransactions.filter(t =>
                t.portfolioAssetId === row.assetId && ['BUY', 'SIP'].includes(t.transactionType)
            )
            const firstInvestmentDate = assetTxns.length > 0
                ? assetTxns.reduce((min, t) => t.transactionDate < min ? t.transactionDate : min, assetTxns[0].transactionDate)
                : now.toISOString().split('T')[0]

            const daysSince = (now.getTime() - new Date(firstInvestmentDate).getTime()) / (1000 * 60 * 60 * 24)
            const years     = daysSince / 365.25
            const cagr      = (years >= 1 && row.costBasis > 0)
                ? Math.pow(currentValue / row.costBasis, 1 / years) - 1
                : null

            const assetFlows = buildAssetFlows(row.assetId, allTransactions, currentValue)
            const xirrValue  = safeXirr(assetFlows)

            assetAnalyticsList.push({
                assetId: row.assetId,
                name: row.name,
                type: row.type as AssetType,
                category: row.category as AssetCategory,
                subCategory: asset?.subCategory ?? null,
                totalUnits: row.totalUnits,
                currentNav,
                currentValue,
                avco: row.avco,
                costBasis: row.costBasis,
                totalInvested: row.totalAcquisitionCost,
                unrealizedPl,
                unrealizedPlPct,
                realizedPl: row.realizedPl,
                totalPl: unrealizedPl + row.realizedPl,
                xirr: xirrValue,
                cagr,
                dayGainLoss,
                dayGainLossPct,
                allocationPct: 0,
                firstInvestmentDate,
                lastUpdatedAt: row.lastPriceUpdatedAt,
            })

            totalCurrentValue += currentValue
        }

        for (const a of assetAnalyticsList) {
            a.allocationPct = totalCurrentValue > 0 ? (a.currentValue / totalCurrentValue) * 100 : 0
        }

        const portfolioXirr = safeXirr(buildPortfolioFlows(allTransactions, totalCurrentValue))

        const portfolioDayGainLoss    = hasDayData ? totalDayGainLoss : null
        const portfolioDayGainLossPct = (hasDayData && totalYesterdayValue > 0)
            ? (totalDayGainLoss / totalYesterdayValue) * 100
            : null

        const allocation          = buildAllocation(assetAnalyticsList, totalCurrentValue)
        const monthlyInvestments  = computeMonthlyInvestments(allTransactions)

        const totalCostBasis      = assetAnalyticsList.reduce((s, a) => s + a.costBasis, 0)
        const totalInvested       = assetAnalyticsList.reduce((s, a) => s + a.totalInvested, 0)
        const totalUnrealizedPl   = assetAnalyticsList.reduce((s, a) => s + a.unrealizedPl, 0)
        const totalUnrealizedPlPct = totalCostBasis > 0 ? (totalUnrealizedPl / totalCostBasis) * 100 : 0
        const totalRealizedPl     = assetAnalyticsList.reduce((s, a) => s + a.realizedPl, 0)

        return {
            totalCurrentValue,
            totalCostBasis,
            totalInvested,
            totalUnrealizedPl,
            totalUnrealizedPlPct,
            totalRealizedPl,
            totalPl: totalUnrealizedPl + totalRealizedPl,
            xirr: portfolioXirr,
            dayGainLoss: portfolioDayGainLoss,
            dayGainLossPct: portfolioDayGainLossPct,
            assets: assetAnalyticsList,
            allocation,
            monthlyInvestments,
            portfolioValueHistory: [],  // fetched separately via portfolio:analytics:value-history
            asOfDate: now.toISOString(),
        }
    }

    getAssetAnalytics(assetId: number): AssetAnalytics {
        const db = profileSessionService.getDatabaseConnection()
        if (!db) throw new Error('No active database connection. Open a profile first.')

        const txnRepo   = new PortfolioTransactionRepositoryImpl(db)
        const priceRepo = new PortfolioPriceRepositoryImpl(db)
        const assetRepo = new PortfolioAssetRepositoryImpl(db)

        const allSummary = txnRepo.getSummary()
        const row        = allSummary.find(r => r.assetId === assetId)
        if (!row) throw new Error(`Asset ${assetId} has no holdings in portfolio_summary`)

        const asset          = assetRepo.getById(assetId)
        const allTransactions = txnRepo.listAll()
        const now            = new Date()
        const todayISO       = now.toISOString().split('T')[0]

        const currentNav   = row.currentPrice ?? 0
        const currentValue = row.currentValue ?? 0
        const unrealizedPl = row.unrealizedPl ?? 0
        const unrealizedPlPct = row.costBasis > 0 ? (unrealizedPl / row.costBasis) * 100 : 0

        const yesterdayNav = priceRepo.getLatestBefore(assetId, todayISO)
        let dayGainLoss: number | null = null
        let dayGainLossPct: number | null = null
        if (yesterdayNav !== null) {
            dayGainLoss    = row.totalUnits * (currentNav - yesterdayNav)
            dayGainLossPct = yesterdayNav !== 0 ? ((currentNav - yesterdayNav) / yesterdayNav) * 100 : null
        }

        const assetTxns = allTransactions.filter(t =>
            t.portfolioAssetId === assetId && ['BUY', 'SIP'].includes(t.transactionType)
        )
        const firstInvestmentDate = assetTxns.length > 0
            ? assetTxns.reduce((min, t) => t.transactionDate < min ? t.transactionDate : min, assetTxns[0].transactionDate)
            : now.toISOString().split('T')[0]

        const daysSince = (now.getTime() - new Date(firstInvestmentDate).getTime()) / (1000 * 60 * 60 * 24)
        const years     = daysSince / 365.25
        const cagr      = (years >= 1 && row.costBasis > 0)
            ? Math.pow(currentValue / row.costBasis, 1 / years) - 1
            : null

        const xirrValue = safeXirr(buildAssetFlows(assetId, allTransactions, currentValue))

        const totalPortfolioValue = allSummary.reduce((s, r) => s + (r.currentValue ?? 0), 0)
        const allocationPct       = totalPortfolioValue > 0 ? (currentValue / totalPortfolioValue) * 100 : 0

        return {
            assetId,
            name: row.name,
            type: row.type as AssetType,
            category: row.category as AssetCategory,
            subCategory: asset?.subCategory ?? null,
            totalUnits: row.totalUnits,
            currentNav,
            currentValue,
            avco: row.avco,
            costBasis: row.costBasis,
            totalInvested: row.totalAcquisitionCost,
            unrealizedPl,
            unrealizedPlPct,
            realizedPl: row.realizedPl,
            totalPl: unrealizedPl + row.realizedPl,
            xirr: xirrValue,
            cagr,
            dayGainLoss,
            dayGainLossPct,
            allocationPct,
            firstInvestmentDate,
            lastUpdatedAt: row.lastPriceUpdatedAt,
        }
    }

    getNavHistory(assetId: number, fromDate: string, toDate: string): { date: string; nav: number }[] {
        const db = profileSessionService.getDatabaseConnection()
        if (!db) throw new Error('No active database connection. Open a profile first.')

        const priceRepo = new PortfolioPriceRepositoryImpl(db)
        return priceRepo.getHistoryByAsset(assetId, fromDate, toDate)
            .map(row => ({ date: row.recordedDate, nav: row.price }))
    }

    getPortfolioValueHistory(fromDate: string): PortfolioValuePoint[] {
        const db = profileSessionService.getDatabaseConnection()
        if (!db) throw new Error('No active database connection. Open a profile first.')

        const txnRepo   = new PortfolioTransactionRepositoryImpl(db)
        const priceRepo = new PortfolioPriceRepositoryImpl(db)

        const allPriceRows    = priceRepo.getAllHistoryFrom(fromDate)
        if (allPriceRows.length === 0) return []

        const allTransactions = txnRepo.listAll()
            .filter(t => t.isActive)
            .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate))

        if (allTransactions.length === 0) return []

        // Unique dates from price history
        const dates = [...new Set(allPriceRows.map(r => r.recordedDate))].sort()

        // Price lookup per asset: sorted by date ASC for carry-forward
        const priceByAsset = new Map<number, { date: string; price: number }[]>()
        for (const row of allPriceRows) {
            if (!priceByAsset.has(row.portfolioAssetId)) priceByAsset.set(row.portfolioAssetId, [])
            priceByAsset.get(row.portfolioAssetId)!.push({ date: row.recordedDate, price: row.price })
        }
        const assetIds = [...priceByAsset.keys()]

        // Cumulative invested amount up to each date
        const investedEvents: { date: string; amount: number }[] = []
        let running = 0
        for (const t of allTransactions) {
            if (['BUY', 'SIP'].includes(t.transactionType)) {
                running += t.quantity * t.pricePerUnit + t.fees + t.taxes
                const last = investedEvents[investedEvents.length - 1]
                if (last && last.date === t.transactionDate) {
                    last.amount = running
                } else {
                    investedEvents.push({ date: t.transactionDate, amount: running })
                }
            }
        }

        function getInvestedAsOf(date: string): number {
            let result = 0
            for (const e of investedEvents) {
                if (e.date <= date) result = e.amount
                else break
            }
            return result
        }

        function getUnitsAsOf(assetId: number, date: string): number {
            return allTransactions
                .filter(t => t.portfolioAssetId === assetId && t.transactionDate <= date)
                .reduce((sum, t) => {
                    if (['BUY', 'SIP'].includes(t.transactionType)) return sum + t.quantity
                    if (t.transactionType === 'DIVIDEND' && t.isDividendReinvestment) return sum + t.quantity
                    if (['SELL', 'REDEMPTION'].includes(t.transactionType)) return sum - t.quantity
                    return sum
                }, 0)
        }

        function getPriceAsOf(assetId: number, date: string): number | null {
            const prices = priceByAsset.get(assetId) ?? []
            let last: number | null = null
            for (const p of prices) {
                if (p.date <= date) last = p.price
                else break
            }
            return last
        }

        const result: PortfolioValuePoint[] = []
        for (const date of dates) {
            const invested = getInvestedAsOf(date)
            if (invested === 0) continue

            let currentValue = 0
            for (const assetId of assetIds) {
                const price = getPriceAsOf(assetId, date)
                if (price === null) continue
                const units = getUnitsAsOf(assetId, date)
                currentValue += Math.max(0, units) * price
            }

            result.push({ date, invested, currentValue })
        }

        return result
    }
}

/* ------------------------------------------------------------------ */
/* Pure helpers (no DB access)                                         */
/* ------------------------------------------------------------------ */

function buildAllocation(assets: AssetAnalytics[], totalValue: number): AllocationBreakdown {
    const byAsset = assets.map(a => ({
        assetId: a.assetId,
        name: a.name,
        value: a.currentValue,
        pct: totalValue > 0 ? (a.currentValue / totalValue) * 100 : 0,
    }))

    const typeMap = new Map<string, number>()
    const catMap  = new Map<string, number>()
    const subMap  = new Map<string, number>()
    for (const a of assets) {
        typeMap.set(a.type, (typeMap.get(a.type) ?? 0) + a.currentValue)
        catMap.set(a.category, (catMap.get(a.category) ?? 0) + a.currentValue)
        if (a.subCategory) subMap.set(a.subCategory, (subMap.get(a.subCategory) ?? 0) + a.currentValue)
    }

    return {
        byAsset,
        byType: [...typeMap.entries()].map(([type, value]) => ({
            type: type as AssetType,
            value,
            pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
        })),
        byCategory: [...catMap.entries()].map(([category, value]) => ({
            category: category as AssetCategory,
            value,
            pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
        })),
        bySubCategory: [...subMap.entries()].map(([subCategory, value]) => ({
            subCategory: subCategory as AssetSubCategory,
            value,
            pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
        })),
    }
}

function computeMonthlyInvestments(transactions: PortfolioTransaction[]): MonthlyInvestment[] {
    const now          = new Date()
    const twelveMonths = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    const fromMonth    = twelveMonths.toISOString().substring(0, 7)

    const monthMap = new Map<string, number>()

    // Pre-fill all 12 months with 0
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
        monthMap.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0)
    }

    for (const t of transactions) {
        if (!['BUY', 'SIP'].includes(t.transactionType) || !t.isActive) continue
        const month = t.transactionDate.substring(0, 7)
        if (month < fromMonth) continue
        monthMap.set(month, (monthMap.get(month) ?? 0) + t.quantity * t.pricePerUnit)
    }

    return [...monthMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({ month, amount }))
}
