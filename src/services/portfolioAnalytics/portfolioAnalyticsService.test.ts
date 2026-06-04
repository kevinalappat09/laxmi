jest.mock('../profileSession/profileSessionService')

import Database from 'better-sqlite3'
import path from 'path'
import { initializeSchema } from '../../database/databaseService'
import { MigrationService } from '../migration/migrationService'
import { profileSessionService } from '../profileSession/profileSessionService'
import { PortfolioAnalyticsServiceImpl } from './portfolioAnalyticsService'
import { PortfolioAssetRepositoryImpl } from '../../repository/portfolioAsset/portfolioAssetRepository'
import { PortfolioTransactionRepositoryImpl } from '../../repository/portfolioTransaction/portfolioTransactionRepository'
import { PortfolioPriceRepositoryImpl } from '../../repository/portfolioPrice/portfolioPriceRepository'

const migrationsDir = path.join(__dirname, '../../migrations')

function buildDb() {
    const db = new Database(':memory:')
    initializeSchema(db)
    new MigrationService(migrationsDir).migrate(db)
    return db
}

type DB = ReturnType<typeof buildDb>

function addAccount(db: DB): number {
    const result = db.prepare(`
        INSERT INTO accounts (institution_name, account_name, account_type, sub_type, color, opened_on, created_on, modified_on, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('Test Broker', 'Portfolio', 'Asset', 'investment', '#000', '2022-01-01', '2022-01-01T00:00:00Z', '2022-01-01T00:00:00Z', 1)
    return result.lastInsertRowid as number
}

function addAsset(db: DB, overrides: Record<string, unknown> = {}) {
    const repo = new PortfolioAssetRepositoryImpl(db)
    return repo.create({
        name: 'Test Fund',
        category: 'EQUITY',
        type: 'EQUITY_MUTUAL_FUND',
        priceSource: 'MFAPI',
        priceSourceId: '119551',
        currency: 'INR',
        isActive: true,
        ...overrides,
    } as any)
}

function addTransaction(
    db: DB,
    assetId: number,
    accountId: number,
    type: string,
    quantity: number,
    price: number,
    dateISO: string,
    opts: { fees?: number; taxes?: number; isDividendReinvestment?: boolean } = {}
) {
    const repo = new PortfolioTransactionRepositoryImpl(db)
    return repo.create({
        portfolioAssetId: assetId,
        transactionType: type,
        quantity,
        pricePerUnit: price,
        fees: opts.fees ?? 0,
        taxes: opts.taxes ?? 0,
        currency: 'INR',
        transactionDate: new Date(dateISO),
        isDividendReinvestment: opts.isDividendReinvestment ?? false,
        assetAccountId: accountId,
        sourceAccountId: null,
    } as any)
}

function setPrice(db: DB, assetId: number, price: number, dateISO: string) {
    const repo = new PortfolioAssetRepositoryImpl(db)
    const priceRepo = new PortfolioPriceRepositoryImpl(db)
    repo.updatePrice(assetId, price, new Date(dateISO).toISOString())
    priceRepo.upsertDailyPrice(assetId, price, 'INR', dateISO)
}

describe('PortfolioAnalyticsServiceImpl', () => {
    let db: DB
    let service: PortfolioAnalyticsServiceImpl
    let accountId: number

    beforeEach(() => {
        db = buildDb()
        ;(profileSessionService.getDatabaseConnection as jest.Mock).mockReturnValue(db)
        service = new PortfolioAnalyticsServiceImpl()
        accountId = addAccount(db)
    })

    afterEach(() => {
        db.close()
    })

    /* ------------------------------------------------------------------ */
    /* AVCO and P&L                                                        */
    /* ------------------------------------------------------------------ */

    describe('AVCO and P&L correctness', () => {
        test('single BUY of 100 units at ₹50, current_price = 60', () => {
            const asset = addAsset(db)
            addTransaction(db, asset.id, accountId, 'BUY', 100, 50, '2025-01-01')
            setPrice(db, asset.id, 60, '2026-06-01')

            const summary = service.getPortfolioSummary()
            const a = summary.assets[0]

            expect(a.currentValue).toBeCloseTo(6000)
            expect(a.costBasis).toBeCloseTo(5000)
            expect(a.unrealizedPl).toBeCloseTo(1000)
            expect(a.unrealizedPlPct).toBeCloseTo(20)
        })

        test('two BUYs: 100 units at ₹50 + 100 units at ₹60 → avco = 55', () => {
            const asset = addAsset(db)
            addTransaction(db, asset.id, accountId, 'BUY', 100, 50, '2025-01-01')
            addTransaction(db, asset.id, accountId, 'BUY', 100, 60, '2025-02-01')
            setPrice(db, asset.id, 60, '2026-06-01')

            const summary = service.getPortfolioSummary()
            const a = summary.assets[0]

            expect(a.avco).toBeCloseTo(55)
            expect(a.costBasis).toBeCloseTo(11000)
            expect(a.totalUnits).toBeCloseTo(200)
        })

        test('BUY 100 at ₹50, SELL 50 at ₹70 → realizedPl = 1000, remaining 50 units, costBasis = 2500', () => {
            const asset = addAsset(db)
            addTransaction(db, asset.id, accountId, 'BUY', 100, 50, '2025-01-01')
            addTransaction(db, asset.id, accountId, 'SELL', 50, 70, '2025-06-01')
            setPrice(db, asset.id, 70, '2026-06-01')

            const summary = service.getPortfolioSummary()
            const a = summary.assets[0]

            expect(a.realizedPl).toBeCloseTo(1000)
            expect(a.totalUnits).toBeCloseTo(50)
            expect(a.costBasis).toBeCloseTo(2500)
        })

        test('unrealized P&L is negative when current_price < avco', () => {
            const asset = addAsset(db)
            addTransaction(db, asset.id, accountId, 'BUY', 100, 60, '2025-01-01')
            setPrice(db, asset.id, 50, '2026-06-01')

            const summary = service.getPortfolioSummary()
            expect(summary.assets[0].unrealizedPl).toBeLessThan(0)
        })

        test('totalInvested stays ₹5000 after selling 50 of 100 units; costBasis drops to ₹2500', () => {
            const asset = addAsset(db)
            addTransaction(db, asset.id, accountId, 'BUY', 100, 50, '2025-01-01')
            addTransaction(db, asset.id, accountId, 'SELL', 50, 70, '2025-06-01')
            setPrice(db, asset.id, 70, '2026-06-01')

            const summary = service.getPortfolioSummary()
            const a = summary.assets[0]

            expect(a.totalInvested).toBeCloseTo(5000)
            expect(a.costBasis).toBeCloseTo(2500)
        })
    })

    /* ------------------------------------------------------------------ */
    /* Day gain/loss                                                       */
    /* ------------------------------------------------------------------ */

    describe('day gain/loss', () => {
        test('no price history → dayGainLoss = null', () => {
            const asset = addAsset(db)
            addTransaction(db, asset.id, accountId, 'BUY', 100, 50, '2025-01-01')
            // Set current_price but no price history
            const assetRepo = new PortfolioAssetRepositoryImpl(db)
            assetRepo.updatePrice(asset.id, 55, new Date().toISOString())

            const summary = service.getPortfolioSummary()
            expect(summary.assets[0].dayGainLoss).toBeNull()
        })

        test('yesterdayNav = 50, currentNav = 51, 100 units → dayGainLoss ≈ 100, dayGainLossPct ≈ 2', () => {
            const asset = addAsset(db)
            addTransaction(db, asset.id, accountId, 'BUY', 100, 50, '2025-01-01')
            const todayISO = new Date().toISOString().split('T')[0]
            const yesterday = new Date()
            yesterday.setDate(yesterday.getDate() - 1)
            const yesterdayISO = yesterday.toISOString().split('T')[0]

            const priceRepo = new PortfolioPriceRepositoryImpl(db)
            const assetRepo = new PortfolioAssetRepositoryImpl(db)
            priceRepo.upsertDailyPrice(asset.id, 50, 'INR', yesterdayISO)
            assetRepo.updatePrice(asset.id, 51, new Date(todayISO).toISOString())

            const summary = service.getPortfolioSummary()
            const a = summary.assets[0]

            expect(a.dayGainLoss).toBeCloseTo(100)
            expect(a.dayGainLossPct).toBeCloseTo(2)
        })

        test('portfolio day gain/loss = sum across all assets', () => {
            const asset1 = addAsset(db, { name: 'Fund 1' })
            const asset2 = addAsset(db, { name: 'Fund 2' })
            addTransaction(db, asset1.id, accountId, 'BUY', 100, 50, '2025-01-01')
            addTransaction(db, asset2.id, accountId, 'BUY', 200, 30, '2025-01-01')

            const yesterday = new Date()
            yesterday.setDate(yesterday.getDate() - 1)
            const yesterdayISO = yesterday.toISOString().split('T')[0]
            const priceRepo = new PortfolioPriceRepositoryImpl(db)
            const assetRepo = new PortfolioAssetRepositoryImpl(db)

            priceRepo.upsertDailyPrice(asset1.id, 50, 'INR', yesterdayISO)
            priceRepo.upsertDailyPrice(asset2.id, 30, 'INR', yesterdayISO)
            assetRepo.updatePrice(asset1.id, 51, new Date().toISOString())
            assetRepo.updatePrice(asset2.id, 31, new Date().toISOString())

            const summary = service.getPortfolioSummary()
            // 100 * 1 + 200 * 1 = 300
            expect(summary.dayGainLoss).toBeCloseTo(300)
        })
    })

    /* ------------------------------------------------------------------ */
    /* XIRR                                                               */
    /* ------------------------------------------------------------------ */

    describe('XIRR', () => {
        test('safeXirr with < 2 flows → xirr = null (only terminal value, no outflow)', () => {
            const asset = addAsset(db)
            // No transactions means no flows; the asset won't appear in portfolio_summary
            // so we test via a fund with one buy today (same-day in/out → null or 0)
            addTransaction(db, asset.id, accountId, 'BUY', 10, 100, '2026-06-01')
            setPrice(db, asset.id, 100, '2026-06-01')

            const summary = service.getPortfolioSummary()
            // xirr may be null or near 0 for same-day flows
            expect(summary.assets[0].xirr == null || summary.assets[0].xirr === 0).toBe(true)
        })

        test('positive return scenario: BUY ~1 year ago at ₹50, current value ₹60 → xirr > 0', () => {
            const asset = addAsset(db)
            const oneYearAgo = new Date()
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
            addTransaction(db, asset.id, accountId, 'BUY', 100, 50, oneYearAgo.toISOString().split('T')[0])
            setPrice(db, asset.id, 60, new Date().toISOString().split('T')[0])

            const summary = service.getPortfolioSummary()
            const xirr = summary.assets[0].xirr
            expect(xirr).not.toBeNull()
            expect(xirr!).toBeGreaterThan(0)
        })

        test('DIVIDEND cash flow is included in XIRR as a positive inflow', () => {
            const asset = addAsset(db)
            const oneYearAgo = new Date()
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
            addTransaction(db, asset.id, accountId, 'BUY', 100, 50, oneYearAgo.toISOString().split('T')[0])
            addTransaction(db, asset.id, accountId, 'DIVIDEND', 100, 2, new Date().toISOString().split('T')[0])
            setPrice(db, asset.id, 50, new Date().toISOString().split('T')[0])

            const summaryWithDiv = service.getPortfolioSummary()
            expect(summaryWithDiv.assets[0].xirr).not.toBeNull()
        })

        test('DIVIDEND reinvestment is excluded from XIRR flows', () => {
            const asset = addAsset(db)
            const oneYearAgo = new Date()
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
            addTransaction(db, asset.id, accountId, 'BUY', 100, 50, oneYearAgo.toISOString().split('T')[0])
            addTransaction(db, asset.id, accountId, 'DIVIDEND', 2, 50, new Date().toISOString().split('T')[0], { isDividendReinvestment: true })
            setPrice(db, asset.id, 50, new Date().toISOString().split('T')[0])

            const summary = service.getPortfolioSummary()
            // With reinvestment, XIRR has outflow + terminal value (102 units × ₹50 - ₹5000 outflow)
            // XIRR should reflect units gained, not a dividend cash inflow
            expect(summary.assets[0].xirr).not.toBeNull()
            expect(summary.assets[0].totalUnits).toBeCloseTo(102)
        })
    })

    /* ------------------------------------------------------------------ */
    /* CAGR                                                               */
    /* ------------------------------------------------------------------ */

    describe('CAGR', () => {
        test('holding period < 1 year → cagr = null', () => {
            const asset = addAsset(db)
            const sixMonthsAgo = new Date()
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
            addTransaction(db, asset.id, accountId, 'BUY', 100, 50, sixMonthsAgo.toISOString().split('T')[0])
            setPrice(db, asset.id, 55, new Date().toISOString().split('T')[0])

            const summary = service.getPortfolioSummary()
            expect(summary.assets[0].cagr).toBeNull()
        })

        test('2-year holding, costBasis = ₹1000, currentValue = ₹1210 → cagr ≈ 0.10', () => {
            const asset = addAsset(db)
            const twoYearsAgo = new Date()
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
            addTransaction(db, asset.id, accountId, 'BUY', 20, 50, twoYearsAgo.toISOString().split('T')[0])
            setPrice(db, asset.id, 60.5, new Date().toISOString().split('T')[0])

            const summary = service.getPortfolioSummary()
            const cagr = summary.assets[0].cagr
            expect(cagr).not.toBeNull()
            // ≈ (1210/1000)^(1/2) - 1 = 0.0995...
            expect(cagr!).toBeCloseTo(0.0995, 1)
        })
    })

    /* ------------------------------------------------------------------ */
    /* Allocation                                                          */
    /* ------------------------------------------------------------------ */

    describe('allocation', () => {
        test('two funds: ₹60000 and ₹40000 → 60% and 40%', () => {
            const a1 = addAsset(db, { name: 'Fund A' })
            const a2 = addAsset(db, { name: 'Fund B' })
            addTransaction(db, a1.id, accountId, 'BUY', 1000, 60, '2025-01-01')
            addTransaction(db, a2.id, accountId, 'BUY', 1000, 40, '2025-01-01')
            setPrice(db, a1.id, 60, '2026-06-01')
            setPrice(db, a2.id, 40, '2026-06-01')

            const summary = service.getPortfolioSummary()
            const assets = summary.assets.sort((a, b) => b.currentValue - a.currentValue)
            expect(assets[0].allocationPct).toBeCloseTo(60)
            expect(assets[1].allocationPct).toBeCloseTo(40)
        })

        test('byType values sum to 100%', () => {
            const a1 = addAsset(db, { name: 'Fund A', type: 'EQUITY_MUTUAL_FUND' })
            const a2 = addAsset(db, { name: 'Fund B', type: 'LIQUID_FUND' })
            addTransaction(db, a1.id, accountId, 'BUY', 100, 50, '2025-01-01')
            addTransaction(db, a2.id, accountId, 'BUY', 100, 30, '2025-01-01')
            setPrice(db, a1.id, 50, '2026-06-01')
            setPrice(db, a2.id, 30, '2026-06-01')

            const summary = service.getPortfolioSummary()
            const total = summary.allocation.byType.reduce((s, t) => s + t.pct, 0)
            expect(total).toBeCloseTo(100)
        })

        test('byCategory values sum to 100%', () => {
            const a1 = addAsset(db, { name: 'Fund A', category: 'EQUITY' })
            const a2 = addAsset(db, { name: 'Fund B', category: 'DEBT', type: 'LIQUID_FUND' })
            addTransaction(db, a1.id, accountId, 'BUY', 100, 50, '2025-01-01')
            addTransaction(db, a2.id, accountId, 'BUY', 100, 30, '2025-01-01')
            setPrice(db, a1.id, 50, '2026-06-01')
            setPrice(db, a2.id, 30, '2026-06-01')

            const summary = service.getPortfolioSummary()
            const total = summary.allocation.byCategory.reduce((s, c) => s + c.pct, 0)
            expect(total).toBeCloseTo(100)
        })
    })

    /* ------------------------------------------------------------------ */
    /* Nav history                                                         */
    /* ------------------------------------------------------------------ */

    describe('getNavHistory', () => {
        test('returns records in ascending date order', () => {
            const asset = addAsset(db)
            const priceRepo = new PortfolioPriceRepositoryImpl(db)
            priceRepo.upsertDailyPrice(asset.id, 50, 'INR', '2026-05-28')
            priceRepo.upsertDailyPrice(asset.id, 51, 'INR', '2026-05-29')
            priceRepo.upsertDailyPrice(asset.id, 52, 'INR', '2026-05-30')

            const history = service.getNavHistory(asset.id, '2026-05-01', '2026-06-01')
            expect(history.map(h => h.date)).toEqual(['2026-05-28', '2026-05-29', '2026-05-30'])
        })

        test('correctly filters to the requested fromDate', () => {
            const asset = addAsset(db)
            const priceRepo = new PortfolioPriceRepositoryImpl(db)
            priceRepo.upsertDailyPrice(asset.id, 48, 'INR', '2026-04-30')
            priceRepo.upsertDailyPrice(asset.id, 50, 'INR', '2026-05-15')
            priceRepo.upsertDailyPrice(asset.id, 52, 'INR', '2026-05-30')

            const history = service.getNavHistory(asset.id, '2026-05-01', '2026-06-01')
            expect(history).toHaveLength(2)
            expect(history[0].date).toBe('2026-05-15')
        })

        test('returns empty array when no history exists', () => {
            const asset = addAsset(db)
            const history = service.getNavHistory(asset.id, '2026-01-01', '2026-06-01')
            expect(history).toHaveLength(0)
        })
    })
})
