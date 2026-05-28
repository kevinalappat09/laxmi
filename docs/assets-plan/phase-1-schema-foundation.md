# Phase 1 — Schema Foundation

**Goal:** Database schema, TypeScript types, and repository layer exist and are fully tested. Nothing is visible in the UI yet.

**Depends on:** Phase 0 complete — `recurring_transactions` must have nullable `account_id` before Phase 5 can build SIP.

**Unlocks:** Phase 2 (services need repositories), Phase 3 (price refresh writes to these tables), all analytics.

**Do not build:** Services, IPC handlers, any UI.

---

## What gets delivered

| Deliverable | Location |
|-------------|----------|
| Migration 9 — `portfolio_assets` table | `src/migrations/9-create_portfolio_assets.ts` |
| Migration 10 — `portfolio_transactions` table + views | `src/migrations/10-create_portfolio_transactions.ts` |
| Migration 11 — `portfolio_price_history` table | `src/migrations/11-create_portfolio_price_history.ts` |
| TypeScript types — assets | `src/types/portfolioAsset.ts` |
| TypeScript types — transactions | `src/types/portfolioTransaction.ts` |
| TypeScript types — analytics | `src/types/portfolioAnalytics.ts` |
| Repository — assets | `src/repository/portfolioAsset/portfolioAssetRepository.ts` |
| Repository — transactions | `src/repository/portfolioTransaction/portfolioTransactionRepository.ts` |
| Repository — price history | `src/repository/portfolioPrice/portfolioPriceRepository.ts` |
| Tests — all three repositories | alongside each repository file |

---

## Step 1 — Migrations

### Migration 9 — `portfolio_assets`

**`src/migrations/9-create_portfolio_assets.ts`**

```ts
import { SQLiteDatabase } from '../database/databaseService'

export function up(db: SQLiteDatabase): void {
    db.exec(`
        CREATE TABLE portfolio_assets (
            id                    INTEGER PRIMARY KEY AUTOINCREMENT,
            name                  TEXT NOT NULL,
            category              TEXT NOT NULL,
            type                  TEXT NOT NULL,
            sub_category          TEXT,
            price_source          TEXT,
            price_source_id       TEXT,
            current_price         REAL,
            last_price_updated_at TEXT,
            currency              TEXT NOT NULL DEFAULT 'INR',
            metadata              TEXT,
            is_active             INTEGER NOT NULL DEFAULT 1,
            created_on            TEXT NOT NULL,
            modified_on           TEXT NOT NULL
        );
        CREATE INDEX idx_portfolio_assets_type   ON portfolio_assets(type);
        CREATE INDEX idx_portfolio_assets_active ON portfolio_assets(is_active);
    `)
}
```

**Column notes:**
- `category`: `'EQUITY' | 'DEBT'`
- `type`: `'EQUITY_MUTUAL_FUND' | 'LIQUID_FUND'` in v1; `'STOCK' | 'ETF'` reserved for future
- `sub_category`: finer classification within type — nullable, user-assigned when adding a fund. Values: `'large_cap' | 'mid_cap' | 'small_cap' | 'flexi_cap' | 'index' | 'elss' | 'liquid' | 'debt' | 'hybrid' | 'international'`
- `price_source`: `'MFAPI'` in v1; `'YAHOO'` reserved for future stock/ETF support
- `price_source_id`: AMFI scheme code (e.g. `119551`) for MFAPI; NSE/BSE ticker for YAHOO (future)
- `last_price_updated_at`: ISO 8601 UTC — used to decide whether a refresh is needed
- `metadata`: JSON blob — `{ schemeCode, amc }` for MFs; `{ ticker }` for stocks/ETFs (future)

---

### Migration 10 — `portfolio_transactions` + views

**`src/migrations/10-create_portfolio_transactions.ts`**

```ts
import { SQLiteDatabase } from '../database/databaseService'

export function up(db: SQLiteDatabase): void {
    db.exec(`
        CREATE TABLE portfolio_transactions (
            id                        INTEGER PRIMARY KEY AUTOINCREMENT,
            portfolio_asset_id        INTEGER NOT NULL,
            transaction_type          TEXT NOT NULL,
            quantity                  REAL NOT NULL CHECK(quantity >= 0),
            price_per_unit            REAL NOT NULL CHECK(price_per_unit > 0),
            fees                      REAL NOT NULL DEFAULT 0,
            taxes                     REAL NOT NULL DEFAULT 0,
            currency                  TEXT NOT NULL DEFAULT 'INR',
            transaction_date          TEXT NOT NULL,
            is_dividend_reinvestment  INTEGER NOT NULL DEFAULT 0,
            asset_account_id          INTEGER NOT NULL,
            source_account_id         INTEGER,
            linked_recurring_id       INTEGER,
            note                      TEXT,
            is_active                 INTEGER NOT NULL DEFAULT 1,
            created_on                TEXT NOT NULL,
            modified_on               TEXT NOT NULL,
            FOREIGN KEY(portfolio_asset_id) REFERENCES portfolio_assets(id),
            FOREIGN KEY(asset_account_id)   REFERENCES accounts(account_id),
            FOREIGN KEY(source_account_id)  REFERENCES accounts(account_id)
        );

        CREATE INDEX idx_ptxn_asset  ON portfolio_transactions(portfolio_asset_id);
        CREATE INDEX idx_ptxn_date   ON portfolio_transactions(transaction_date);
        CREATE INDEX idx_ptxn_active ON portfolio_transactions(is_active);

        CREATE VIEW portfolio_holdings AS
        SELECT
            portfolio_asset_id,
            SUM(
                CASE
                    WHEN transaction_type IN ('BUY', 'SIP')                                    THEN  quantity
                    WHEN transaction_type = 'DIVIDEND' AND is_dividend_reinvestment = 1        THEN  quantity
                    WHEN transaction_type IN ('SELL', 'REDEMPTION')                            THEN -quantity
                    ELSE 0
                END
            ) AS total_units,
            SUM(
                CASE
                    WHEN transaction_type IN ('BUY', 'SIP')                             THEN  quantity
                    WHEN transaction_type = 'DIVIDEND' AND is_dividend_reinvestment = 1 THEN  quantity
                    ELSE 0
                END
            ) AS total_units_acquired,
            SUM(
                CASE
                    WHEN transaction_type IN ('BUY', 'SIP')                             THEN (quantity * price_per_unit) + fees + taxes
                    WHEN transaction_type = 'DIVIDEND' AND is_dividend_reinvestment = 1 THEN  quantity * price_per_unit
                    ELSE 0
                END
            ) AS total_acquisition_cost,
            SUM(
                CASE
                    WHEN transaction_type IN ('SELL', 'REDEMPTION') THEN (quantity * price_per_unit) - fees - taxes
                    ELSE 0
                END
            ) AS total_sale_proceeds,
            SUM(
                CASE
                    WHEN transaction_type IN ('SELL', 'REDEMPTION') THEN quantity
                    ELSE 0
                END
            ) AS total_units_sold
        FROM portfolio_transactions
        WHERE is_active = 1
        GROUP BY portfolio_asset_id;

        CREATE VIEW portfolio_summary AS
        SELECT
            a.id                   AS asset_id,
            a.name,
            a.category,
            a.type,
            a.current_price,
            a.currency,
            a.last_price_updated_at,
            h.total_units,
            h.total_units_acquired,
            h.total_acquisition_cost,
            h.total_sale_proceeds,
            CASE
                WHEN h.total_units_acquired > 0
                THEN h.total_acquisition_cost / h.total_units_acquired
                ELSE 0
            END AS avco,
            CASE
                WHEN h.total_units_acquired > 0
                THEN (h.total_acquisition_cost / h.total_units_acquired) * h.total_units
                ELSE 0
            END AS cost_basis,
            h.total_units * a.current_price AS current_value,
            (h.total_units * a.current_price)
                - ((h.total_acquisition_cost / NULLIF(h.total_units_acquired, 0)) * h.total_units)
                AS unrealized_pl,
            h.total_sale_proceeds
                - ((h.total_acquisition_cost / NULLIF(h.total_units_acquired, 0)) * h.total_units_sold)
                AS realized_pl
        FROM portfolio_assets a
        JOIN portfolio_holdings h ON a.id = h.portfolio_asset_id
        WHERE a.is_active = 1
          AND h.total_units > 0;
    `)
}
```

**Schema design notes:**

`asset_account_id` vs `source_account_id`:
- `asset_account_id` (NOT NULL) — the investment account where this asset is held (e.g. your Zerodha account in Laxmi). Mandatory for every transaction. Does **not** affect the Zerodha account balance in Laxmi — it is a custodian reference, not a double-entry leg.
- `source_account_id` (nullable) — the bank/savings account you transferred money from (e.g. HDFC Savings). When set, the service creates a matching `withdraw` or `deposit` on that account. When null (ESOPs, employer grants, existing holdings), no Laxmi transaction is created.

**Transaction types:** `BUY | SELL | SIP | REDEMPTION | DIVIDEND`

**`is_dividend_reinvestment`:** `1` = units added (reinvestment); `0` = cash payout (creates a `deposit` on `source_account_id` if set).

**Views:**
- `portfolio_holdings` — net units, AVCO inputs per asset. Excludes `is_active = 0` rows.
- `portfolio_summary` — joins assets + holdings. Only shows active assets with `total_units > 0` (fully exited positions are excluded from the live dashboard).

---

### Migration 11 — `portfolio_price_history`

**`src/migrations/11-create_portfolio_price_history.ts`**

```ts
import { SQLiteDatabase } from '../database/databaseService'

export function up(db: SQLiteDatabase): void {
    db.exec(`
        CREATE TABLE portfolio_price_history (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            portfolio_asset_id INTEGER NOT NULL,
            price              REAL NOT NULL,
            currency           TEXT NOT NULL DEFAULT 'INR',
            recorded_date      TEXT NOT NULL,
            created_on         TEXT NOT NULL,
            FOREIGN KEY(portfolio_asset_id) REFERENCES portfolio_assets(id)
        );

        CREATE UNIQUE INDEX idx_pph_asset_date ON portfolio_price_history(portfolio_asset_id, recorded_date);
        CREATE INDEX        idx_pph_asset      ON portfolio_price_history(portfolio_asset_id);
    `)
}
```

The `UNIQUE INDEX` on `(portfolio_asset_id, recorded_date)` enforces one record per asset per calendar day. Combined with `INSERT OR REPLACE` in the repository, this prevents duplicates automatically and allows idempotent SIP NAV back-fill.

---

## Step 2 — TypeScript Types

Follow the existing pattern: JSDoc `@module` / `@description` / `@stability` header on each file.

### `src/types/portfolioAsset.ts`

```ts
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
```

---

### `src/types/portfolioTransaction.ts`

```ts
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
    note?: string
}
```

---

### `src/types/portfolioAnalytics.ts`

```ts
/**
 * @module portfolioAnalytics
 * @description Defines analytics result types for the portfolio module.
 * @stability experimental
 */

import { AssetCategory, AssetType } from './portfolioAsset'

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
```

---

## Step 3 — Repository Implementations

Follow the existing pattern from `src/repository/account/accountRepository.ts`:
- Export an `interface` with the method signatures
- Export a `*RepositoryImpl` class that takes `db: SQLiteDatabase` in the constructor
- Use raw parameterised SQL via `db.prepare().run()` / `.get()` / `.all()`
- No ORMs

### `src/repository/portfolioAsset/portfolioAssetRepository.ts`

**Interface:**

```ts
export interface PortfolioAssetRepository {
    create(request: CreatePortfolioAssetRequest): PortfolioAsset
    update(id: number, request: UpdatePortfolioAssetRequest): PortfolioAsset
    deactivate(id: number): void
    getById(id: number): PortfolioAsset | null
    listActive(): PortfolioAsset[]
    listByPriceSource(source: PriceSource): PortfolioAsset[]
    updatePrice(id: number, price: number, updatedAt: string): void
}
```

**Implementation notes:**
- `create`: INSERT with `created_on = modified_on = new Date().toISOString()`; serialize `metadata` with `JSON.stringify`; return `getById(lastInsertRowid)`
- `getById`: parse `metadata` with `JSON.parse` if not null; map `is_active` integer to boolean
- `updatePrice`: `UPDATE portfolio_assets SET current_price = ?, last_price_updated_at = ?, modified_on = ? WHERE id = ?`
- `deactivate`: `UPDATE portfolio_assets SET is_active = 0, modified_on = ? WHERE id = ?`

---

### `src/repository/portfolioTransaction/portfolioTransactionRepository.ts`

**Interface:**

```ts
export interface PortfolioTransactionRepository {
    create(request: CreatePortfolioTransactionRequest & { quantity: number }): PortfolioTransaction
    deactivate(id: number): void
    listByAsset(portfolioAssetId: number): PortfolioTransaction[]
    listAll(): PortfolioTransaction[]
    getHoldings(): PortfolioHoldingRow[]
    getSummary(): PortfolioSummaryRow[]
    getTotalUnitsHeld(portfolioAssetId: number): number
}

export interface PortfolioHoldingRow {
    portfolioAssetId: number
    totalUnits: number
    totalUnitsAcquired: number
    totalAcquisitionCost: number
    totalSaleProceeds: number
    totalUnitsSold: number
}

export interface PortfolioSummaryRow extends PortfolioHoldingRow {
    assetId: number
    name: string
    category: string
    type: string
    currentPrice: number | null
    currency: string
    lastPriceUpdatedAt: string | null
    avco: number
    costBasis: number
    currentValue: number | null
    unrealizedPl: number | null
    realizedPl: number
}
```

**Implementation notes:**
- `create` receives the request with `quantity` already resolved (the service layer handles `investedAmount → quantity` conversion before calling the repository)
- `getHoldings`: `SELECT * FROM portfolio_holdings`
- `getSummary`: `SELECT * FROM portfolio_summary`
- `listByAsset`: `SELECT * FROM portfolio_transactions WHERE portfolio_asset_id = ? AND is_active = 1 ORDER BY transaction_date DESC`
- `getTotalUnitsHeld`: `SELECT COALESCE(total_units, 0) FROM portfolio_holdings WHERE portfolio_asset_id = ?` — used by the service for oversell validation

---

### `src/repository/portfolioPrice/portfolioPriceRepository.ts`

**Interface:**

```ts
export interface PortfolioPriceRepository {
    upsertDailyPrice(assetId: number, price: number, currency: string, date: string): void
    getHistoryByAsset(assetId: number, fromDate: string, toDate: string): PriceHistoryRow[]
    getLatestBefore(assetId: number, beforeDate: string): number | null
    getNavForDate(assetId: number, date: string): number | null
}

export interface PriceHistoryRow {
    portfolioAssetId: number
    price: number
    currency: string
    recordedDate: string
}
```

**Implementation notes:**
- `upsertDailyPrice`: `INSERT OR REPLACE INTO portfolio_price_history (portfolio_asset_id, price, currency, recorded_date, created_on) VALUES (?, ?, ?, ?, ?)`
  — The `UNIQUE INDEX` on `(portfolio_asset_id, recorded_date)` makes `INSERT OR REPLACE` behave as an upsert
- `getLatestBefore`: `SELECT price FROM portfolio_price_history WHERE portfolio_asset_id = ? AND recorded_date < ? ORDER BY recorded_date DESC LIMIT 1`
- `getNavForDate`: `SELECT price FROM portfolio_price_history WHERE portfolio_asset_id = ? AND recorded_date = ?` — exact date lookup; returns null if no record for that date (used by SIP processing to check if history already has the due date's NAV)

---

## Tests

Use the same pattern as `src/repository/account/accountRepository.test.ts`:
1. Open an in-memory SQLite database
2. Run all migrations 1–11 in sequence
3. Exercise each method

### `portfolioAssetRepository.test.ts`

- [ ] `create` inserts a row and returns the full `PortfolioAsset` object with correct field mapping
- [ ] `create` serializes `metadata` JSON correctly; `getById` deserializes it back
- [ ] `listActive` returns only rows where `is_active = 1`
- [ ] `listActive` excludes deactivated assets
- [ ] `listByPriceSource('MFAPI')` returns only MFAPI assets
- [ ] `updatePrice` sets both `current_price` and `last_price_updated_at`; `modified_on` is updated
- [ ] `deactivate` sets `is_active = 0`; `getById` still returns the row (soft delete)
- [ ] `update` merges partial fields; unchanged fields are preserved

### `portfolioTransactionRepository.test.ts`

- [ ] `create` persists `quantity`, `price_per_unit`, `fees`, `taxes`, `transaction_date`, `asset_account_id` correctly
- [ ] `create` persists `source_account_id = null` when not provided
- [ ] `getHoldings` — one BUY: `total_units = quantity`
- [ ] `getHoldings` — two BUYs: `total_units = sum of quantities`
- [ ] `getHoldings` — BUY then partial SELL: `total_units = buy_qty - sell_qty`
- [ ] `getHoldings` — DIVIDEND with `is_dividend_reinvestment = 1`: units added to `total_units`
- [ ] `getSummary` — AVCO = `total_acquisition_cost / total_units_acquired`
- [ ] `getSummary` — `unrealized_pl = total_units * current_price - cost_basis`
- [ ] `getSummary` — fully exited position (`total_units = 0`) is NOT returned (view WHERE clause)
- [ ] `deactivate` — deactivated transaction is excluded from `portfolio_holdings` totals
- [ ] `listByAsset` returns transactions in descending date order
- [ ] `getTotalUnitsHeld` — returns 0 when no transactions exist for asset
- [ ] `getTotalUnitsHeld` — returns correct units after BUY + partial SELL

### `portfolioPriceRepository.test.ts`

- [ ] `upsertDailyPrice` — first call inserts a new row
- [ ] `upsertDailyPrice` — second call same asset + same date replaces (row count stays at 1)
- [ ] `upsertDailyPrice` — second call same asset + different date creates a second row
- [ ] `getHistoryByAsset` — returns rows filtered to the requested date range, ascending order
- [ ] `getLatestBefore` — returns the price of the most recent record strictly before `beforeDate`
- [ ] `getLatestBefore` — returns `null` when no history exists for the asset
- [ ] `getLatestBefore` — does not return a record on `beforeDate` itself (strict `<`)
- [ ] `getNavForDate` — returns price when an exact date match exists
- [ ] `getNavForDate` — returns `null` when no record exists for that exact date

---

## Verify — Definition of Done

- [ ] `npm test` passes: all three repository test suites green, zero failures
- [ ] `tsc --noEmit` — no TypeScript errors
- [ ] `npm run dev` — app opens cleanly; migrations 9, 10, 11 run without errors on a fresh profile
- [ ] Manual SQL check: insert two BUY rows for the same asset, then query `portfolio_holdings` — `total_units` is the correct sum
- [ ] Manual SQL check: insert a BUY then a SELL for all units, query `portfolio_summary` — the asset does NOT appear (fully exited)
- [ ] Manual SQL check: `upsertDailyPrice` twice for the same asset + date — `SELECT COUNT(*) FROM portfolio_price_history` returns 1, not 2
