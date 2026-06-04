jest.mock('../profileSession/profileSessionService')
jest.mock('./providers/mfapiProvider')
jest.mock('./providers/yahooProvider')

import Database from 'better-sqlite3'
import path from 'path'
import { initializeSchema } from '../../database/databaseService'
import { MigrationService } from '../migration/migrationService'
import { profileSessionService } from '../profileSession/profileSessionService'
import { PriceUpdaterServiceImpl } from './priceUpdaterService'
import { MfapiProviderImpl } from './providers/mfapiProvider'
import { YahooProviderImpl } from './providers/yahooProvider'
import { PortfolioAssetRepositoryImpl } from '../../repository/portfolioAsset/portfolioAssetRepository'
import { PortfolioPriceRepositoryImpl } from '../../repository/portfolioPrice/portfolioPriceRepository'

const migrationsDir = path.join(__dirname, '../../migrations')

function buildDb() {
    const db = new Database(':memory:')
    initializeSchema(db)
    new MigrationService(migrationsDir).migrate(db)
    return db
}

function createAsset(db: ReturnType<typeof buildDb>, overrides: Record<string, unknown> = {}) {
    const repo = new PortfolioAssetRepositoryImpl(db)
    return repo.create({
        name: overrides.name as string ?? 'Test Fund',
        category: 'EQUITY',
        type: 'EQUITY_MUTUAL_FUND',
        priceSource: (overrides.priceSource as string) ?? 'MFAPI',
        priceSourceId: (overrides.priceSourceId as string) ?? '119551',
        currency: 'INR',
        isActive: true,
        ...overrides,
    } as any)
}

const MockMfapi = MfapiProviderImpl as jest.MockedClass<typeof MfapiProviderImpl>
const MockYahoo = YahooProviderImpl as jest.MockedClass<typeof YahooProviderImpl>

describe('PriceUpdaterServiceImpl', () => {
    let db: ReturnType<typeof buildDb>
    let service: PriceUpdaterServiceImpl
    let mockMfapiGetLatest: jest.Mock
    let mockYahooGetLatest: jest.Mock

    beforeEach(() => {
        db = buildDb()
        ;(profileSessionService.getDatabaseConnection as jest.Mock).mockReturnValue(db)
        mockMfapiGetLatest = jest.fn().mockResolvedValue(500)
        mockYahooGetLatest = jest.fn().mockResolvedValue(1500)
        MockMfapi.mockImplementation(() => ({
            getLatestPrice: mockMfapiGetLatest,
            getNavForDate: jest.fn(),
        }) as any)
        MockYahoo.mockImplementation(() => ({
            getLatestPrice: mockYahooGetLatest,
            getNavForDate: jest.fn(),
        }) as any)
        service = new PriceUpdaterServiceImpl()
    })

    afterEach(() => {
        db.close()
        jest.clearAllMocks()
    })

    describe('refreshStaleAssets', () => {
        it('skips an asset whose lastPriceUpdatedAt is within the 6-hour threshold', async () => {
            const repo = new PortfolioAssetRepositoryImpl(db)
            const asset = createAsset(db)
            const recentIso = new Date(Date.now() - 30 * 60 * 1000).toISOString()  // 30 min ago
            repo.updatePrice(asset.id, 450, recentIso)

            const result = await service.refreshStaleAssets()

            expect(result.skippedCount).toBe(1)
            expect(result.refreshedCount).toBe(0)
            expect(mockMfapiGetLatest).not.toHaveBeenCalled()
        })

        it('refreshes an asset with lastPriceUpdatedAt = null (never fetched)', async () => {
            createAsset(db)  // never had a price set

            const result = await service.refreshStaleAssets()

            expect(result.refreshedCount).toBe(1)
            expect(result.skippedCount).toBe(0)
            expect(mockMfapiGetLatest).toHaveBeenCalledWith('119551')
        })

        it('refreshes an asset past its MFAPI 6-hour threshold', async () => {
            const repo = new PortfolioAssetRepositoryImpl(db)
            const asset = createAsset(db)
            const staleIso = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString()  // 7 hr ago
            repo.updatePrice(asset.id, 400, staleIso)

            const result = await service.refreshStaleAssets()

            expect(result.refreshedCount).toBe(1)
            expect(mockMfapiGetLatest).toHaveBeenCalledWith('119551')
        })

        it('refreshes a YAHOO asset past its 15-minute threshold', async () => {
            const repo = new PortfolioAssetRepositoryImpl(db)
            const asset = createAsset(db, { priceSource: 'YAHOO', priceSourceId: 'INFY.NS' })
            const staleIso = new Date(Date.now() - 20 * 60 * 1000).toISOString()  // 20 min ago
            repo.updatePrice(asset.id, 1400, staleIso)

            const result = await service.refreshStaleAssets()

            expect(result.refreshedCount).toBe(1)
            expect(mockYahooGetLatest).toHaveBeenCalledWith('INFY.NS')
        })

        it('updates portfolio_assets.current_price on successful refresh', async () => {
            mockMfapiGetLatest.mockResolvedValue(892.456)
            const asset = createAsset(db)

            await service.refreshStaleAssets()

            const repo = new PortfolioAssetRepositoryImpl(db)
            const updated = repo.getById(asset.id)!
            expect(updated.currentPrice).toBe(892.456)
            expect(updated.lastPriceUpdatedAt).not.toBeNull()
        })

        it('creates a portfolio_price_history row for today on successful refresh', async () => {
            mockMfapiGetLatest.mockResolvedValue(892.456)
            const asset = createAsset(db)
            const todayISO = new Date().toISOString().split('T')[0]

            await service.refreshStaleAssets()

            const priceRepo = new PortfolioPriceRepositoryImpl(db)
            const history = priceRepo.getHistoryByAsset(asset.id, todayISO, todayISO)
            expect(history).toHaveLength(1)
            expect(history[0].price).toBe(892.456)
        })

        it('upserts — only one history row after two refreshes on the same day', async () => {
            mockMfapiGetLatest.mockResolvedValue(892.456)
            const asset = createAsset(db)
            const todayISO = new Date().toISOString().split('T')[0]

            // First refresh
            await service.refreshStaleAssets()

            // Make asset stale again for second refresh
            const repo = new PortfolioAssetRepositoryImpl(db)
            const staleIso = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString()
            repo.updatePrice(asset.id, 892.456, staleIso)

            // Second refresh
            mockMfapiGetLatest.mockResolvedValue(895.000)
            await service.refreshStaleAssets()

            const priceRepo = new PortfolioPriceRepositoryImpl(db)
            const history = priceRepo.getHistoryByAsset(asset.id, todayISO, todayISO)
            expect(history).toHaveLength(1)
            expect(history[0].price).toBe(895)
        })

        it('collects failed asset in result without stopping others from refreshing', async () => {
            const failAsset  = createAsset(db, { name: 'Failing Fund', priceSourceId: '111111' })
            const okAsset    = createAsset(db, { name: 'OK Fund',      priceSourceId: '222222' })

            mockMfapiGetLatest
                .mockRejectedValueOnce(new Error('API error'))
                .mockResolvedValueOnce(500)

            const result = await service.refreshStaleAssets()

            expect(result.failedAssets).toHaveLength(1)
            expect(result.failedAssets[0].assetId).toBe(failAsset.id)
            expect(result.failedAssets[0].name).toBe('Failing Fund')
            expect(result.refreshedCount).toBe(1)

            const repo = new PortfolioAssetRepositoryImpl(db)
            expect(repo.getById(okAsset.id)!.currentPrice).toBe(500)
        })
    })

    describe('refreshAll', () => {
        it('refreshes even an asset within the staleness threshold', async () => {
            const repo = new PortfolioAssetRepositoryImpl(db)
            const asset = createAsset(db)
            const recentIso = new Date(Date.now() - 30 * 60 * 1000).toISOString()
            repo.updatePrice(asset.id, 450, recentIso)

            const result = await service.refreshAll()

            expect(result.refreshedCount).toBe(1)
            expect(result.skippedCount).toBe(0)
            expect(mockMfapiGetLatest).toHaveBeenCalled()
        })
    })

    describe('refreshAsset', () => {
        it('refreshes only the specified asset', async () => {
            mockMfapiGetLatest.mockResolvedValue(900)
            const asset1 = createAsset(db, { name: 'Fund 1', priceSourceId: '111' })
            const asset2 = createAsset(db, { name: 'Fund 2', priceSourceId: '222' })

            const result = await service.refreshAsset(asset1.id)

            expect(result.refreshedCount).toBe(1)
            expect(mockMfapiGetLatest).toHaveBeenCalledTimes(1)
            expect(mockMfapiGetLatest).toHaveBeenCalledWith('111')

            const repo = new PortfolioAssetRepositoryImpl(db)
            expect(repo.getById(asset1.id)!.currentPrice).toBe(900)
            expect(repo.getById(asset2.id)!.currentPrice).toBeNull()
        })

        it('throws when asset does not exist', async () => {
            await expect(service.refreshAsset(9999)).rejects.toThrow('Asset 9999 not found')
        })
    })
})
