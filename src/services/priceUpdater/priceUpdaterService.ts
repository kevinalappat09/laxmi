import { profileSessionService } from '../profileSession/profileSessionService'
import { PortfolioAssetRepositoryImpl } from '../../repository/portfolioAsset/portfolioAssetRepository'
import { PortfolioPriceRepositoryImpl } from '../../repository/portfolioPrice/portfolioPriceRepository'
import type { PriceProvider } from './providers/priceProvider'
import { MfapiProviderImpl } from './providers/mfapiProvider'
import { YahooProviderImpl } from './providers/yahooProvider'
import type { PriceRefreshResult } from '../../types/portfolioAnalytics'
import type { PortfolioAsset, PriceSource } from '../../types/portfolioAsset'

export interface PriceUpdaterService {
    refreshStaleAssets(): Promise<PriceRefreshResult>
    refreshAll(): Promise<PriceRefreshResult>
    refreshAsset(assetId: number): Promise<PriceRefreshResult>
}

const MFAPI_THRESHOLD_MS  = 6 * 60 * 60 * 1000   // 6 hours
const YAHOO_THRESHOLD_MS  = 15 * 60 * 1000         // 15 minutes

export class PriceUpdaterServiceImpl implements PriceUpdaterService {
    private readonly mfapiProvider = new MfapiProviderImpl()
    private readonly yahooProvider: PriceProvider = new YahooProviderImpl()

    private getProvider(priceSource: PriceSource): PriceProvider {
        switch (priceSource) {
            case 'MFAPI': return this.mfapiProvider
            case 'YAHOO': return this.yahooProvider
        }
    }

    private thresholdFor(priceSource: PriceSource): number {
        return priceSource === 'YAHOO' ? YAHOO_THRESHOLD_MS : MFAPI_THRESHOLD_MS
    }

    async refreshStaleAssets(): Promise<PriceRefreshResult> {
        const db = profileSessionService.getDatabaseConnection()
        if (!db) throw new Error('No active database connection. Open a profile first.')
        const repo      = new PortfolioAssetRepositoryImpl(db)
        const priceRepo = new PortfolioPriceRepositoryImpl(db)
        const now       = new Date()
        const todayISO  = now.toISOString().split('T')[0]
        const result: PriceRefreshResult = { refreshedCount: 0, skippedCount: 0, failedAssets: [], asOf: now.toISOString() }

        const assetsToRefresh: PortfolioAsset[] = []
        for (const asset of repo.listActive()) {
            if (!asset.priceSource || !asset.priceSourceId) {
                result.skippedCount++
                continue
            }

            const lastUpdated = asset.lastPriceUpdatedAt ? new Date(asset.lastPriceUpdatedAt) : null
            const isStale     = !lastUpdated || (now.getTime() - lastUpdated.getTime()) > this.thresholdFor(asset.priceSource)

            if (!isStale) {
                result.skippedCount++
                continue
            }

            assetsToRefresh.push(asset)
        }

        await this.refreshAssets(assetsToRefresh, now, todayISO, repo, priceRepo, result)
        return result
    }

    async refreshAll(): Promise<PriceRefreshResult> {
        const db = profileSessionService.getDatabaseConnection()
        if (!db) throw new Error('No active database connection. Open a profile first.')
        const repo      = new PortfolioAssetRepositoryImpl(db)
        const priceRepo = new PortfolioPriceRepositoryImpl(db)
        const now       = new Date()
        const todayISO  = now.toISOString().split('T')[0]
        const result: PriceRefreshResult = { refreshedCount: 0, skippedCount: 0, failedAssets: [], asOf: now.toISOString() }

        const assetsToRefresh: PortfolioAsset[] = []
        for (const asset of repo.listActive()) {
            if (!asset.priceSource || !asset.priceSourceId) {
                result.skippedCount++
                continue
            }

            assetsToRefresh.push(asset)
        }

        await this.refreshAssets(assetsToRefresh, now, todayISO, repo, priceRepo, result)
        return result
    }

    async refreshAsset(assetId: number): Promise<PriceRefreshResult> {
        const db = profileSessionService.getDatabaseConnection()
        if (!db) throw new Error('No active database connection. Open a profile first.')
        const repo      = new PortfolioAssetRepositoryImpl(db)
        const priceRepo = new PortfolioPriceRepositoryImpl(db)
        const now       = new Date()
        const todayISO  = now.toISOString().split('T')[0]
        const result: PriceRefreshResult = { refreshedCount: 0, skippedCount: 0, failedAssets: [], asOf: now.toISOString() }

        const asset = repo.getById(assetId)
        if (!asset) {
            throw new Error(`Asset ${assetId} not found`)
        }

        if (!asset.priceSource || !asset.priceSourceId) {
            result.skippedCount++
            return result
        }

        await this.refreshAssets([asset], now, todayISO, repo, priceRepo, result)
        return result
    }

    private async refreshAssets(
        assets: PortfolioAsset[],
        now: Date,
        todayISO: string,
        repo: PortfolioAssetRepositoryImpl,
        priceRepo: PortfolioPriceRepositoryImpl,
        result: PriceRefreshResult
    ): Promise<void> {
        const mfapiAssets = assets.filter(asset => asset.priceSource === 'MFAPI')
        let mfapiPrices: Map<string, number> | null = null
        let mfapiError: unknown = null

        if (mfapiAssets.length > 0) {
            try {
                mfapiPrices = await this.mfapiProvider.getAllLatestPrices()
            } catch (err) {
                mfapiError = err
            }
        }

        for (const asset of assets) {
            if (!asset.priceSource || !asset.priceSourceId) continue

            if (asset.priceSource === 'MFAPI') {
                const price = mfapiPrices?.get(asset.priceSourceId)
                if (price == null) {
                    const error = mfapiError instanceof Error
                        ? mfapiError.message
                        : `No current NAV found in MFAPI's latest dataset`
                    result.failedAssets.push({ assetId: asset.id, name: asset.name, error })
                    continue
                }
                this.storePrice(asset, price, now, todayISO, repo, priceRepo, result)
                continue
            }

            await this.fetchAndStore(
                asset.id,
                asset.name,
                asset.priceSource,
                asset.priceSourceId,
                asset.currency,
                now,
                todayISO,
                repo,
                priceRepo,
                result
            )
        }
    }

    private storePrice(
        asset: PortfolioAsset,
        price: number,
        now: Date,
        todayISO: string,
        repo: PortfolioAssetRepositoryImpl,
        priceRepo: PortfolioPriceRepositoryImpl,
        result: PriceRefreshResult
    ): void {
        repo.updatePrice(asset.id, price, now.toISOString())
        priceRepo.upsertDailyPrice(asset.id, price, asset.currency, todayISO)
        result.refreshedCount++
    }

    private async fetchAndStore(
        assetId: number,
        name: string,
        priceSource: PriceSource,
        priceSourceId: string,
        currency: string,
        now: Date,
        todayISO: string,
        repo: PortfolioAssetRepositoryImpl,
        priceRepo: PortfolioPriceRepositoryImpl,
        result: PriceRefreshResult
    ): Promise<void> {
        try {
            const provider = this.getProvider(priceSource)
            const price    = await provider.getLatestPrice(priceSourceId)
            repo.updatePrice(assetId, price, now.toISOString())
            priceRepo.upsertDailyPrice(assetId, price, currency, todayISO)
            result.refreshedCount++
        } catch (err) {
            result.failedAssets.push({
                assetId,
                name,
                error: err instanceof Error ? err.message : String(err),
            })
        }
    }
}
