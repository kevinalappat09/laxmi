# Phase 3 — Price Providers

**Goal:** Assets show a live NAV in the portfolio list. Prices refresh automatically in the background when the app is opened and the price is stale or missing. User can trigger a manual refresh. Price history accumulates one record per asset per day. Prices are **never** shown as live data in the transaction dialog — the transaction price is always entered manually by the user.

**Depends on:** Phase 2 complete — assets must exist in the DB for the refresh service to have something to update.

**Unlocks:** Phase 4 — analytics requires `current_price` to be non-null for meaningful numbers. Phase 5 — SIP processing needs `getNavForDate` to look up historical NAVs for due dates.

---

## Price philosophy

Two distinct uses of price data:

| Use | Source | Who sets it |
|-----|--------|-------------|
| Portfolio list display (current value, day gain/loss) | Live from MFAPI | Auto-refreshed in background |
| Transaction entry (NAV at time of purchase/sale) | User input | User types it manually |
| SIP execution (NAV at SIP due date) | Historical from MFAPI | Fetched synchronously before SIP fires |

The transaction dialog has **no live price pre-fill**. The user knows what NAV they transacted at (from their broker's confirmation). This avoids wrong unit calculations when prices are stale or market-hours vs NAV timing doesn't match.

---

## What gets delivered

| Deliverable | Location |
|-------------|----------|
| `yahoo-finance2@3.14.1` pinned in `package.json` | root `package.json` + `.npmrc` |
| `PriceProvider` interface | `src/services/priceUpdater/providers/priceProvider.ts` |
| MFAPI provider (with historical NAV lookup) | `src/services/priceUpdater/providers/mfapiProvider.ts` |
| Yahoo Finance provider (future stocks/ETFs) | `src/services/priceUpdater/providers/yahooProvider.ts` |
| Price updater service | `src/services/priceUpdater/priceUpdaterService.ts` |
| Auto-refresh hook on profile open | `src/services/profile/profileService.ts` |
| IPC handlers (refresh-all, refresh-asset) | `main.ts` |
| preload prices namespace | `preload.ts`, `renderer/src/types/global.d.ts` |
| PortfolioPage NAV column + staleness badge + refresh button | `renderer/src/pages/portfolio/PortfolioPage.tsx` |
| Provider and service tests | alongside each file |

---

## Step 1 — Pin Dependencies

**`package.json`** (root, not `renderer/`) — add to `dependencies`:

```json
"yahoo-finance2": "3.14.1"
```

**`.npmrc`** (root) — add:

```ini
save-exact=true
```

After adding:
1. Run `npm install`
2. Verify `package-lock.json` contains `"yahoo-finance2"` at exactly `3.14.1` with an `integrity` hash
3. Commit both `package.json` and `package-lock.json`

**Why exact pinning:** Active npm supply chain attacks in 2026 (TanStack breach, TeamPCP campaigns) have compromised packages with valid provenance. Exact pins prevent automatic ingestion of malicious updates. `npm ci` validates the integrity hash on every install.

---

## Step 2 — `PriceProvider` Interface

**`src/services/priceUpdater/providers/priceProvider.ts`**

```ts
/**
 * @module priceProvider
 * @description Defines the PriceProvider interface for all asset price data sources.
 * @stability experimental
 * @extension-points
 * - PriceProvider — implement to add a new data source
 * - Register in PriceUpdaterServiceImpl.getProvider()
 */

export interface PriceProvider {
    /** Get the latest available price for a given source identifier */
    getLatestPrice(sourceId: string): Promise<number>
    /**
     * Get the NAV for a specific date. Used by SIP processing to find the due-date NAV.
     * Returns the NAV for `date` if available, or the nearest available date on or after `date`
     * (matching how Indian SIPs handle holiday dates — allotment happens at next business day NAV).
     * Returns null if no price data is available at all.
     */
    getNavForDate(sourceId: string, date: string): Promise<number | null>
}
```

`sourceId` meaning depends on the provider:
- MFAPI: AMFI scheme code (e.g. `119551`)
- Yahoo (future): full ticker with exchange suffix (e.g. `INFY.NS`, `NIFTYBEES.NS`)

---

## Step 3 — MFAPI Provider

**`src/services/priceUpdater/providers/mfapiProvider.ts`**

```ts
import type { PriceProvider } from './priceProvider'

interface MfapiHistoricalEntry { date: string; nav: string }  // date: "DD-MM-YYYY"

export class MfapiProviderImpl implements PriceProvider {
    async getLatestPrice(schemeCode: string): Promise<number> {
        const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`)
        if (!res.ok) {
            throw new Error(`MFAPI returned ${res.status} for scheme code ${schemeCode}`)
        }
        const json = await res.json() as { status: string; data: MfapiHistoricalEntry[] }
        if (!json.data?.length) {
            throw new Error(`MFAPI returned empty data for scheme code ${schemeCode}`)
        }
        return parseFloat(json.data[0].nav)
    }

    async getNavForDate(schemeCode: string, isoDate: string): Promise<number | null> {
        // Fetch full history — sorted descending by date
        const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`)
        if (!res.ok) return null

        const json = await res.json() as { data: MfapiHistoricalEntry[] }
        if (!json.data?.length) return null

        // Convert MFAPI "DD-MM-YYYY" dates to "YYYY-MM-DD" for comparison
        const entries = json.data.map(e => ({
            iso: this.mfapiDateToISO(e.date),
            nav: parseFloat(e.nav),
        }))

        // Find exact match first
        const exact = entries.find(e => e.iso === isoDate)
        if (exact) return exact.nav

        // Date is a holiday/weekend — find the next available business day on or after isoDate
        // (Real Indian SIP behaviour: if SIP date is a holiday, units allotted at next business day NAV)
        // entries are sorted descending by date, so reverse to find first date >= isoDate
        const next = [...entries].reverse().find(e => e.iso >= isoDate)
        return next?.nav ?? null
    }

    private mfapiDateToISO(ddmmyyyy: string): string {
        const [dd, mm, yyyy] = ddmmyyyy.split('-')
        return `${yyyy}-${mm}-${dd}`
    }
}
```

**NAV update schedule:** MFAPI updates 6× daily: 10:05 AM, 2:05 PM, 6:05 PM, 9:05 PM, 3:09 AM, 5:05 AM IST (sourced from AMFI).

**No npm dependency** — uses Node's built-in `fetch`. Zero additional supply chain surface.

---

## Step 4 — Yahoo Finance Provider (future use)

**`src/services/priceUpdater/providers/yahooProvider.ts`**

```ts
import yahooFinance from 'yahoo-finance2'
import type { PriceProvider } from './priceProvider'

export class YahooProviderImpl implements PriceProvider {
    async getLatestPrice(ticker: string): Promise<number> {
        const quote = await yahooFinance.quote(ticker)
        if (quote.regularMarketPrice == null) {
            throw new Error(`Yahoo Finance returned no price for ${ticker}`)
        }
        return quote.regularMarketPrice
    }

    async getNavForDate(ticker: string, isoDate: string): Promise<number | null> {
        // Stocks/ETFs don't have the same "SIP date" semantics as MFs.
        // If needed in future: use yahooFinance.historical({ period1: isoDate, period2: isoDate })
        // For v1 this path is never called (only MFs have SIPs).
        throw new Error(`getNavForDate not implemented for Yahoo provider — stocks do not support SIP`)
    }
}
```

**Ticker format:**
- `.NS` suffix = NSE — real-time per Yahoo's coverage table
- `.BO` suffix = BSE — 15-minute delayed
- Prefer `.NS`; use `.BO` only for stocks not listed on NSE
- ETFs: same format as stocks (e.g. `NIFTYBEES.NS`, `GOLDBEES.NS`)

**Note:** This provider is pinned and installed now (Step 1) but not called in v1 (all v1 assets are MFAPI). It is wired up and ready for when stock/ETF support is added.

---

## Step 5 — `PriceUpdaterService`

**`src/services/priceUpdater/priceUpdaterService.ts`**

**Interface:**

```ts
export interface PriceUpdaterService {
    refreshStaleAssets(): Promise<PriceRefreshResult>
    refreshAll(): Promise<PriceRefreshResult>
    refreshAsset(assetId: number): Promise<PriceRefreshResult>
}
```

**Staleness thresholds:**

| `price_source` | Auto-refresh threshold |
|----------------|------------------------|
| `MFAPI` | 6 hours — catches same-day evening NAV publication (AMFI publishes ~9–11 PM IST) |
| `YAHOO` | 15 minutes — live market data |

**Refresh trigger rules:**

```
if (asset.lastPriceUpdatedAt is null):
    → always refresh (first time)
elif (now - lastPriceUpdatedAt > threshold):
    → refresh (stale)
else:
    → skip (fresh)
```

**Provider routing:**

```ts
function getProvider(priceSource: PriceSource): PriceProvider {
    switch (priceSource) {
        case 'MFAPI': return mfapiProvider
        case 'YAHOO': return yahooProvider
    }
}
```

**`refreshStaleAssets` logic:**

```ts
async refreshStaleAssets(): Promise<PriceRefreshResult> {
    const db       = profileSessionService.getDatabaseConnection()
    const repo     = new PortfolioAssetRepositoryImpl(db)
    const priceRepo = new PortfolioPriceRepositoryImpl(db)

    const assets   = repo.listActive()
    const now      = new Date()
    const todayISO = now.toISOString().split('T')[0]  // YYYY-MM-DD

    const result: PriceRefreshResult = { refreshedCount: 0, skippedCount: 0, failedAssets: [], asOf: now.toISOString() }

    for (const asset of assets) {
        if (!asset.priceSource || !asset.priceSourceId) {
            result.skippedCount++
            continue
        }

        const thresholdMs  = asset.priceSource === 'YAHOO' ? 15 * 60 * 1000 : 6 * 60 * 60 * 1000
        const lastUpdated  = asset.lastPriceUpdatedAt ? new Date(asset.lastPriceUpdatedAt) : null
        const isStale      = !lastUpdated || (now.getTime() - lastUpdated.getTime()) > thresholdMs

        if (!isStale) {
            result.skippedCount++
            continue
        }

        try {
            const provider = getProvider(asset.priceSource)
            const price    = await provider.getLatestPrice(asset.priceSourceId)
            repo.updatePrice(asset.id, price, now.toISOString())
            priceRepo.upsertDailyPrice(asset.id, price, asset.currency, todayISO)
            result.refreshedCount++
        } catch (err) {
            result.failedAssets.push({
                assetId: asset.id,
                name:    asset.name,
                error:   err instanceof Error ? err.message : String(err),
            })
        }
    }

    return result
}
```

**`refreshAll`:** Same as `refreshStaleAssets` but removes the `isStale` check — refreshes every asset regardless of `lastPriceUpdatedAt`.

**`refreshAsset(assetId)`:** Same logic scoped to one asset, always refreshes (no staleness check).

**Failure isolation:** A provider error on one asset does not stop others from refreshing. Failed assets are collected in `result.failedAssets` and returned to the caller/UI.

---

## Step 6 — Auto-refresh on Profile Open

In `src/services/profile/profileService.ts`, after the existing migration + recurring transaction processing:

```ts
// Fire and forget — do not await; profile open must not block on network.
// SIP processing (Phase 5) fetches its own NAV synchronously before each SIP fires,
// so it does not depend on this background refresh completing first.
priceUpdaterService.refreshStaleAssets()
    .then(result => {
        if (result.failedAssets.length > 0) {
            console.warn('Price refresh partial failure:', result.failedAssets)
        }
    })
    .catch(err => console.error('Background price refresh error:', err))
```

**Important:** `better-sqlite3` is synchronous, but `refreshStaleAssets` is `async` (network calls). The `ipcMain.handle('open-profile', ...)` handler is already `async` — verify this after the change. The profile open response returns to the renderer immediately; the price refresh runs in the background.

---

## Step 7 — IPC Handlers

Add to `main.ts`:

```ts
ipcMain.handle('portfolio:prices:refresh-all',
    () => priceUpdaterService.refreshAll())

ipcMain.handle('portfolio:prices:refresh-asset',
    (_, { assetId }) => priceUpdaterService.refreshAsset(assetId))
```

---

## Step 8 — `preload.ts` + `global.d.ts`

Add `prices` namespace to the existing `portfolio` object in `preload.ts`:

```ts
prices: {
    refreshAll:   () => ipcRenderer.invoke('portfolio:prices:refresh-all'),
    refreshAsset: (assetId: number) => ipcRenderer.invoke('portfolio:prices:refresh-asset', { assetId }),
},
```

Update `renderer/src/types/global.d.ts` accordingly.

---

## Step 9 — UI Updates to `PortfolioPage`

Three additions to the existing page:

**1. NAV column in the fund list**

Add a `Current NAV` column after `Invested`:
- Shows `₹XX.XX` when `asset.currentPrice` is non-null
- Shows `—` when null (first open, price not yet fetched — will appear after background refresh completes)

**2. Staleness badge per asset**

Below or alongside the NAV:
- `"Updated 3 min ago"` — green/muted, within threshold
- `"Stale — updated 6 hrs ago"` — amber/warning colour, beyond threshold
- `"Never updated"` — when `lastPriceUpdatedAt = null`

Use `lastPriceUpdatedAt` from `PortfolioAsset` to compute the elapsed time on the renderer side.

**3. Refresh button in page header**

```
Portfolio                    [↻ Refresh]  [+ Add Fund]
```

- On click: calls `portfolio:prices:refresh-all`
- Shows a spinner while in-flight
- On completion: if `failedAssets.length > 0`, shows a dismissible warning banner listing the failed funds
- On completion: re-fetches the asset list (`portfolio:asset:list`) to show updated NAVs

---

## Tests

### `mfapiProvider.test.ts` — mock `fetch`

```ts
global.fetch = jest.fn()
```

- [ ] `getLatestPrice` — parses `data[0].nav` string into a number correctly (`"892.45600"` → `892.456`)
- [ ] `getLatestPrice` — throws when HTTP status is non-200
- [ ] `getLatestPrice` — throws when `data` array is empty
- [ ] `getLatestPrice` — throws when `fetch` itself rejects (network error propagation)
- [ ] `getNavForDate` — returns nav when exact date match exists in history
- [ ] `getNavForDate` — returns next business day nav when due date is a holiday (no exact match, returns nearest date on or after)
- [ ] `getNavForDate` — returns `null` when no data available at all
- [ ] `mfapiDateToISO` — converts `"28-05-2026"` to `"2026-05-28"` correctly

### `yahooProvider.test.ts` — mock `yahoo-finance2`

```ts
jest.mock('yahoo-finance2')
```

- [ ] `getLatestPrice` — returns `regularMarketPrice` from a mocked quote response
- [ ] `getLatestPrice` — throws with a descriptive message when `regularMarketPrice` is `null`
- [ ] `getLatestPrice` — throws when `yahooFinance.quote` throws (network error propagation)

### `priceUpdaterService.test.ts` — mock both providers + DB

- [ ] `refreshStaleAssets` skips an asset whose `lastPriceUpdatedAt` is within 6-hour threshold
- [ ] `refreshStaleAssets` refreshes an asset with `lastPriceUpdatedAt = null` (never fetched)
- [ ] `refreshStaleAssets` refreshes an asset past its MFAPI threshold (6 hr)
- [ ] `refreshStaleAssets` refreshes an asset past its YAHOO threshold (15 min)
- [ ] On successful refresh: `portfolio_assets.current_price` is updated
- [ ] On successful refresh: `portfolio_price_history` row is created for today
- [ ] On successful refresh same day twice: only one row in `portfolio_price_history` (upsert)
- [ ] On provider error for one asset: that asset appears in `failedAssets`; other assets are still refreshed
- [ ] `refreshAll` refreshes even an asset within threshold
- [ ] `refreshAsset(id)` refreshes only the specified asset

### Manual smoke tests

- [ ] Open profile for first time with one MFAPI fund → NAV shows `—` initially; within a few seconds updates to live price (check `last_price_updated_at` in DB)
- [ ] Open profile again within 6 hours → NAV is NOT re-fetched (threshold)
- [ ] Click `[↻ Refresh]` → all assets refresh regardless of last update time
- [ ] Disconnect network → click refresh → failed assets banner appears; other assets (if any) still refresh
- [ ] `portfolio_price_history` has exactly one row per asset after refreshing multiple times in the same day
- [ ] Staleness badge shows correctly for a fresh asset vs one not updated in >6h (set `last_price_updated_at` manually in DB to simulate)

---

## Verify — Definition of Done

- [ ] `npm test` — all provider and price updater service tests pass
- [ ] `tsc --noEmit` — no TypeScript errors
- [ ] `package-lock.json` shows `yahoo-finance2` at exactly `3.14.1` with an integrity hash
- [ ] Assets show live NAV after profile open (verified visually)
- [ ] `portfolio_price_history` has exactly one row per asset per day after multiple refreshes on the same day
- [ ] Manual refresh button works from the UI
- [ ] Staleness badge correctly shows "fresh" vs "stale" states
- [ ] Failed asset banner is dismissible and accurately names the failed fund
- [ ] Profile open time is not noticeably delayed by the background refresh
- [ ] Transaction dialog has NO price pre-fill — confirms the price is a plain user input
