# Portfolio Tracker — Feature Architecture

## 1. Feature Overview

This document describes the architecture for adding a portfolio tracker module to Laxmi.

**Primary v1 focus: Indian mutual funds.** The schema, providers, and analytics are designed to handle MFs well from day one while remaining structurally identical for stocks and ETFs.

**Three core v1 use cases:**

| # | Use case | Priority |
|---|----------|----------|
| 1 | **Buy an asset** — search for a fund by name, enter an amount (₹), link the debit to a checking/savings account | Must work perfectly |
| 2 | **Track assets** — current value, NAV, day's gain/loss, XIRR, allocation pie chart, per-fund analytics | Must work perfectly |
| 3 | **Sell an asset** — enter units to redeem, link proceeds to an account, see realized P&L | Must be correct; not the primary daily workflow in v1 |

**Core principle:** Portfolio transactions are the immutable source of truth. Holdings, P&L, AVCO cost basis, CAGR, and XIRR are always derived — never stored.

**Future compatibility guarantee:** The schema, transaction model, and analytics layer are designed so that tax harvesting (LTCG/STCG lot tracking), fund switching/rolling, rebalancing targets, and additional asset types can be layered on without schema rewrites. See §17.

---

## 2. Communication Model

Identical to all other Laxmi features. No HTTP layer.

```
Renderer (React)
  → window.financeAPI.portfolio.*  (contextBridge, preload.ts)
    → ipcRenderer.invoke(channel, ...args)
      → ipcMain.handle(channel, handler)  (main.ts)
        → PortfolioServiceImpl / PriceUpdaterServiceImpl / PortfolioAnalyticsServiceImpl
          → RepositoryImpl
            → better-sqlite3  (same per-profile profile.db)
```

---

## 3. Database Schema

### 3.1 `portfolio_assets` — Migration 8

Master registry of all investable assets.

```sql
CREATE TABLE portfolio_assets (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    name                  TEXT NOT NULL,
    category              TEXT NOT NULL,           -- 'EQUITY' | 'DEBT'
    type                  TEXT NOT NULL,           -- 'STOCK' | 'EQUITY_MUTUAL_FUND' | 'LIQUID_FUND' | 'ETF'
    price_source          TEXT,                    -- 'YAHOO' | 'MFAPI'
    price_source_id       TEXT,                   -- ticker (e.g. 'INFY.NS') or scheme code (e.g. '119551')
    current_price         REAL,
    last_price_updated_at TEXT,                   -- ISO 8601 UTC; used to decide whether refresh is needed
    currency              TEXT NOT NULL DEFAULT 'INR',  -- forward-compat: multi-currency support later
    metadata              TEXT,                    -- JSON blob for asset-specific fields (see §3.5)
    is_active             INTEGER NOT NULL DEFAULT 1,
    created_on            TEXT NOT NULL,
    modified_on           TEXT NOT NULL
);

CREATE INDEX idx_portfolio_assets_type ON portfolio_assets(type);
CREATE INDEX idx_portfolio_assets_active ON portfolio_assets(is_active);
```

**`metadata` shape by type:**

| type | JSON fields |
|------|-------------|
| `STOCK` | `{ "ticker": "INFY.NS", "exchange": "NSE", "sector": "IT" }` |
| `EQUITY_MUTUAL_FUND` | `{ "schemeCode": "119551", "amc": "PPFAS", "fundType": "FLEXI_CAP" }` |
| `LIQUID_FUND` | `{ "schemeCode": "120503", "amc": "SBI" }` |
| `ETF` | `{ "ticker": "NIFTYBEES.NS", "exchange": "NSE" }` or `{ "schemeCode": "120716" }` — determined by `price_source` |

`ticker` for YAHOO assets is the full Yahoo Finance symbol including the exchange suffix: `.NS` for NSE (real-time), `.BO` for BSE (15-min delayed). Prefer `.NS` — use `.BO` only for stocks not listed on NSE.

**`price_source` rules by type:**

| type | `price_source` | Notes |
|------|---------------|-------|
| `STOCK` (NSE-listed) | `YAHOO` | Use ticker `INFY.NS` — real-time |
| `STOCK` (BSE-only) | `YAHOO` | Use ticker `INFY.BO` — 15-min delayed |
| `ETF` (exchange-traded) | `YAHOO` | Use ticker `NIFTYBEES.NS` |
| `ETF` (scheme-code-based) | `MFAPI` | For ETFs with an AMFI scheme code |
| `EQUITY_MUTUAL_FUND` | `MFAPI` | Always — NAV updated 6× daily by AMFI |
| `LIQUID_FUND` | `MFAPI` | Always |

---

### 3.2 `portfolio_transactions` — Migration 9

Immutable record of every portfolio event.

```sql
CREATE TABLE portfolio_transactions (
    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_asset_id        INTEGER NOT NULL,
    transaction_type          TEXT NOT NULL,          -- see §3.4
    quantity                  REAL NOT NULL CHECK(quantity > 0),
    price_per_unit            REAL NOT NULL CHECK(price_per_unit > 0),
    fees                      REAL NOT NULL DEFAULT 0,
    taxes                     REAL NOT NULL DEFAULT 0,
    currency                  TEXT NOT NULL DEFAULT 'INR',
    transaction_date          TEXT NOT NULL,          -- YYYY-MM-DD
    is_dividend_reinvestment  INTEGER NOT NULL DEFAULT 0,  -- 1 only when transaction_type = 'DIVIDEND'
    linked_account_id         INTEGER,               -- FK → accounts(account_id); cash dividends or sell proceeds
    linked_recurring_id       INTEGER,               -- FK → recurring_transactions(id); auto-created SIPs
    note                      TEXT,
    is_active                 INTEGER NOT NULL DEFAULT 1,
    created_on                TEXT NOT NULL,
    modified_on               TEXT NOT NULL,
    FOREIGN KEY(portfolio_asset_id) REFERENCES portfolio_assets(id),
    FOREIGN KEY(linked_account_id)  REFERENCES accounts(account_id)
);

CREATE INDEX idx_ptxn_asset   ON portfolio_transactions(portfolio_asset_id);
CREATE INDEX idx_ptxn_date    ON portfolio_transactions(transaction_date);
CREATE INDEX idx_ptxn_active  ON portfolio_transactions(is_active);
```

**Transaction types:**

| `transaction_type` | Description |
|--------------------|-------------|
| `BUY` | Manual one-time purchase |
| `SELL` | Partial or full exit; reduces units |
| `SIP` | Auto-created by recurring system; treated identically to BUY for all calculations |
| `REDEMPTION` | Mutual fund full or partial redemption; treated identically to SELL |
| `DIVIDEND` | Cash payout (`is_dividend_reinvestment = 0`) or reinvestment (`is_dividend_reinvestment = 1`) |

**`is_dividend_reinvestment` semantics:**

- `0` (cash dividend): `linked_account_id` SHOULD be set; a corresponding `deposit` transaction is created on that Laxmi account to keep net worth in sync. `quantity` represents number of units if `quantity > 0`; for pure cash dividends with no unit impact, `quantity` = 0 is valid — relax the `CHECK` to `CHECK(quantity >= 0)`.
- `1` (reinvestment): `quantity` is the number of units received; these units are included in holdings calculation.

> Note: Relax the `CHECK(quantity > 0)` to `CHECK(quantity >= 0)` on `portfolio_transactions` to allow cash dividends with no unit impact.

---

### 3.3 `portfolio_price_history` — Migration 10

One record per asset per calendar day. Used for charting and time-series analytics.

```sql
CREATE TABLE portfolio_price_history (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_asset_id INTEGER NOT NULL,
    price              REAL NOT NULL,
    currency           TEXT NOT NULL DEFAULT 'INR',
    recorded_date      TEXT NOT NULL,   -- YYYY-MM-DD (enforced unique per asset per day)
    created_on         TEXT NOT NULL,
    FOREIGN KEY(portfolio_asset_id) REFERENCES portfolio_assets(id)
);

CREATE UNIQUE INDEX idx_pph_asset_date ON portfolio_price_history(portfolio_asset_id, recorded_date);
CREATE INDEX        idx_pph_asset      ON portfolio_price_history(portfolio_asset_id);
```

The `UNIQUE` index enforces one record per asset per day. On price refresh, the service uses `INSERT OR REPLACE` (SQLite upsert) — this prunes intra-day duplicates automatically.

---

### 3.4 `portfolio_holdings` View — Migration 9

Computes net units and AVCO inputs from transactions.

```sql
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
            WHEN transaction_type IN ('BUY', 'SIP')                                    THEN  quantity
            WHEN transaction_type = 'DIVIDEND' AND is_dividend_reinvestment = 1        THEN  quantity
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
```

---

### 3.5 `portfolio_summary` View — Migration 9

Full snapshot view used by the portfolio page. Excludes fully exited positions.

```sql
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
    END AS avco,                                            -- weighted average cost per unit

    CASE
        WHEN h.total_units_acquired > 0
        THEN (h.total_acquisition_cost / h.total_units_acquired) * h.total_units
        ELSE 0
    END AS cost_basis,                                      -- cost of current holdings at AVCO

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
  AND h.total_units > 0;                                    -- exclude fully exited positions
```

> Fully exited positions (sold everything) are filtered by `h.total_units > 0`. A separate `portfolio_closed_positions` view can be added later if a "history of closed positions" page is needed.

---

### 3.6 Migration 11 — Extend `recurring_transactions` for SIPs

Adds portfolio linkage to the existing recurring transactions table.

```sql
ALTER TABLE recurring_transactions ADD COLUMN portfolio_asset_id INTEGER REFERENCES portfolio_assets(id);
```

A recurring transaction with `portfolio_asset_id IS NOT NULL` is a portfolio SIP. The `account_id` column (already NOT NULL) represents the source funding account that gets debited.

---

## 4. TypeScript Types

### `src/types/portfolioAsset.ts`

```ts
type AssetCategory = 'EQUITY' | 'DEBT'

type AssetType = 'STOCK' | 'EQUITY_MUTUAL_FUND' | 'LIQUID_FUND' | 'ETF'

type PriceSource = 'YAHOO' | 'MFAPI'

interface PortfolioAsset {
    id: number
    name: string
    category: AssetCategory
    type: AssetType
    priceSource: PriceSource | null
    priceSourceId: string | null
    currentPrice: number | null
    lastPriceUpdatedAt: string | null   // ISO 8601 UTC
    currency: string                    // 'INR' in v1
    metadata: Record<string, unknown> | null
    isActive: boolean
    createdOn: string
    modifiedOn: string
}

interface CreatePortfolioAssetRequest {
    name: string
    category: AssetCategory
    type: AssetType
    priceSource: PriceSource | null
    priceSourceId: string | null
    currency?: string
    metadata?: Record<string, unknown>
}

interface UpdatePortfolioAssetRequest {
    name?: string
    priceSource?: PriceSource | null
    priceSourceId?: string | null
    metadata?: Record<string, unknown>
    isActive?: boolean
}
```

---

### `src/types/portfolioTransaction.ts`

```ts
type PortfolioTransactionType = 'BUY' | 'SELL' | 'SIP' | 'REDEMPTION' | 'DIVIDEND'

interface PortfolioTransaction {
    id: number
    portfolioAssetId: number
    transactionType: PortfolioTransactionType
    quantity: number
    pricePerUnit: number
    fees: number
    taxes: number
    currency: string
    transactionDate: string             // YYYY-MM-DD
    isDividendReinvestment: boolean
    linkedAccountId: number | null
    linkedRecurringId: number | null
    note: string | null
    isActive: boolean
    createdOn: string
    modifiedOn: string
}

/**
 * Two investment entry modes:
 *
 * Mode A — Amount-based (mutual funds):
 *   Provide investedAmount (e.g. ₹5000). The service fetches the asset's
 *   current_price (NAV) and computes quantity = investedAmount / pricePerUnit.
 *   Use this when the user invests a rupee amount, not a specific unit count.
 *
 * Mode B — Unit-based (stocks, ETFs):
 *   Provide quantity directly (e.g. 10 shares). pricePerUnit is required in
 *   both modes; for Mode A it is the NAV at the time of the transaction.
 *
 * Exactly one of quantity or investedAmount must be provided. The service
 * throws if both or neither are present.
 *
 * Two funding modes:
 *
 * Mode 1 — Funded from a Laxmi account (linkedAccountId is set):
 *   The service atomically creates both the portfolio_transaction AND a
 *   corresponding Laxmi account transaction:
 *     BUY / SIP       → withdraw from linkedAccountId (amount = quantity * pricePerUnit + fees + taxes)
 *     SELL/REDEMPTION → deposit  to  linkedAccountId (amount = quantity * pricePerUnit - fees - taxes)
 *     DIVIDEND (cash) → deposit  to  linkedAccountId (amount = dividendAmount)
 *
 * Mode 2 — Direct, no Laxmi account (linkedAccountId is null):
 *   Only the portfolio_transaction is created. Use this for:
 *     - Company ESOP grants / vests (no cash leaves a tracked account)
 *     - Employer-matched mutual fund contributions
 *     - Any investment that bypasses a tracked bank account
 */
interface CreatePortfolioTransactionRequest {
    portfolioAssetId: number
    transactionType: PortfolioTransactionType

    // Provide exactly one:
    quantity?: number               // unit-based entry (stocks, ETFs)
    investedAmount?: number         // amount-based entry (mutual funds); quantity derived as investedAmount / pricePerUnit

    pricePerUnit: number            // NAV for MFs; market price for stocks/ETFs
    fees?: number
    taxes?: number
    currency?: string
    transactionDate: Date
    isDividendReinvestment?: boolean
    linkedAccountId?: number        // null = direct (no Laxmi account debit/credit)
    note?: string
}
```

---

### `src/types/portfolioAnalytics.ts`

```ts
interface AssetAnalytics {
    assetId: number
    name: string
    type: AssetType
    category: AssetCategory

    // Holdings
    totalUnits: number
    currentNav: number              // current_price (called "NAV" for MFs, "price" for stocks)
    currentValue: number            // totalUnits * currentNav

    // Cost basis (AVCO)
    avco: number                    // weighted average cost per unit across all acquisitions
    costBasis: number               // avco * totalUnits (cost of current holdings)
    totalInvested: number           // total_acquisition_cost (all money ever put in, including sold lots)

    // P&L
    unrealizedPl: number            // currentValue - costBasis
    unrealizedPlPct: number         // (unrealizedPl / costBasis) * 100
    realizedPl: number              // proceeds from sells - AVCO cost of sold units
    totalPl: number                 // unrealizedPl + realizedPl

    // Returns
    xirr: number | null             // per-asset XIRR; null if < 2 cash flows or solver fails
    cagr: number | null             // null if holding period < 1 year

    // Day change
    dayGainLoss: number | null      // totalUnits * (currentNav - yesterdayNav); null if no history
    dayGainLossPct: number | null   // (currentNav - yesterdayNav) / yesterdayNav * 100

    // Portfolio context
    allocationPct: number           // currentValue / totalPortfolioValue * 100

    // Metadata
    firstInvestmentDate: string     // date of earliest BUY/SIP transaction (YYYY-MM-DD)
    lastUpdatedAt: string | null    // last_price_updated_at from portfolio_assets
}

interface PortfolioSummaryAnalytics {
    totalCurrentValue: number
    totalCostBasis: number
    totalInvested: number
    totalUnrealizedPl: number
    totalUnrealizedPlPct: number
    totalRealizedPl: number
    totalPl: number

    // Portfolio-wide returns
    xirr: number | null             // null if insufficient cash flow data

    // Day change (sum across all assets)
    dayGainLoss: number | null
    dayGainLossPct: number | null

    assets: AssetAnalytics[]
    allocation: AllocationBreakdown
    asOfDate: string                // ISO 8601
}

interface AllocationBreakdown {
    byAsset:    { assetId: number;      name: string;           value: number; pct: number }[]
    byType:     { type: AssetType;                              value: number; pct: number }[]
    byCategory: { category: AssetCategory;                      value: number; pct: number }[]
}

interface XirrCashFlow {
    amount: number                  // negative = outflow (buy), positive = inflow (sell/current value)
    date: Date
}

// Returned by portfolio:mfapi:search
interface MfSearchResult {
    schemeCode: string
    schemeName: string
}
```

---

## 5. Repository Layer

### `src/repository/portfolioAsset/portfolioAssetRepository.ts`

```ts
interface PortfolioAssetRepository {
    create(asset: CreatePortfolioAssetRequest): PortfolioAsset
    update(id: number, request: UpdatePortfolioAssetRequest): PortfolioAsset
    deactivate(id: number): void
    getById(id: number): PortfolioAsset | null
    listActive(): PortfolioAsset[]
    listByPriceSource(source: PriceSource): PortfolioAsset[]
    updatePrice(id: number, price: number, updatedAt: string): void
}
```

### `src/repository/portfolioTransaction/portfolioTransactionRepository.ts`

```ts
interface PortfolioTransactionRepository {
    create(request: CreatePortfolioTransactionRequest): PortfolioTransaction
    deactivate(id: number): void
    listByAsset(portfolioAssetId: number): PortfolioTransaction[]
    listAll(): PortfolioTransaction[]
    getHoldings(): PortfolioHoldingRow[]          // queries portfolio_holdings view
    getSummary(): PortfolioSummaryRow[]           // queries portfolio_summary view
}
```

### `src/repository/portfolioPrice/portfolioPriceRepository.ts`

```ts
interface PortfolioPriceRepository {
    upsertDailyPrice(assetId: number, price: number, currency: string, date: string): void
    getHistoryByAsset(assetId: number, fromDate: string, toDate: string): PriceHistoryRow[]
}
```

All repository implementations follow the existing pattern: `new PortfolioAssetRepositoryImpl(db)` where `db` comes from `profileSessionService.getDatabaseConnection()`.

---

## 6. Service Layer

### 6.1 `src/services/portfolio/portfolioAssetService.ts`

Responsibilities:
- CRUD for `portfolio_assets`
- Validates `priceSource` / `priceSourceId` consistency with `type`
- Parses and validates `metadata` JSON per asset type
- Delegates price updates to `PriceUpdaterService`

**Validation rules:**

| Condition | Error |
|-----------|-------|
| `type = STOCK` and `priceSource != YAHOO` | Reject |
| `type = EQUITY_MUTUAL_FUND \| LIQUID_FUND` and `priceSource != MFAPI` | Reject |
| `priceSource = YAHOO` and `metadata.ticker` absent or does not end in `.NS` / `.BO` | Reject |
| `priceSource = MFAPI` and `metadata.schemeCode` is absent | Reject |

---

### 6.2 `src/services/portfolio/portfolioTransactionService.ts`

Responsibilities:
- CRUD for `portfolio_transactions`
- Validates asset exists and is active before creating a transaction
- Executes both writes atomically inside a `db.transaction()` block when `linked_account_id` is set
- On SIP creation from recurring system: sets `linked_recurring_id`

**`createTransaction` logic:**

```
validate: asset exists and is active
validate: if DIVIDEND, isDividendReinvestment must be explicitly set
validate: if linkedAccountId is set, the account must exist and be active

open db.transaction():
  INSERT INTO portfolio_transactions (...)

  IF linkedAccountId IS NOT NULL:
    SWITCH transactionType:
      BUY | SIP:
        amount = quantity * pricePerUnit + fees + taxes
        TransactionServiceImpl.createTransaction(withdraw, linkedAccountId, amount, ...)
      SELL | REDEMPTION:
        amount = quantity * pricePerUnit - fees - taxes
        TransactionServiceImpl.createTransaction(deposit, linkedAccountId, amount, ...)
      DIVIDEND (cash, not reinvestment):
        amount = quantity * pricePerUnit
        TransactionServiceImpl.createTransaction(deposit, linkedAccountId, amount, ...)
      DIVIDEND (reinvestment):
        no Laxmi account transaction — units are added to portfolio only
  // IF linkedAccountId IS NULL: portfolio_transaction only, no Laxmi side-effect
end transaction
```

The `db.transaction()` wrapper means both writes succeed or both roll back. There is no partial state.

**Why `withdraw` and not `transfer`:**
The existing `transaction_type = 'transfer'` is for money moving between two tracked Laxmi accounts (e.g. HDFC Savings → SBI Savings). Both ends must be `accounts` rows. Here, the destination — a broker (Zerodha, Groww) or an AMC — is not a Laxmi account. The money leaves a tracked account and goes to an external entity; what you receive in return (units) is tracked by the portfolio module instead. So `withdraw` is correct. `transfer` must not be used.

**Payee and category on the auto-created Laxmi transaction:**
- `payee` = asset name (e.g. `"Infosys"`, `"Parag Parikh Flexi Cap"`)
- `category_id` = null (user can categorize later, or a default "Investments" category can be seeded)
- `classification` = `'needs'` (default; user can override)

---

### 6.3 `src/services/priceUpdater/priceUpdaterService.ts`

The most critical service. Handles all external price fetching.

**Responsibilities:**

```
1. Fetch all active portfolio_assets
2. Check last_price_updated_at against the staleness threshold
3. Group by price_source (YAHOO bucket, MFAPI bucket)
4. Dispatch to appropriate provider
5. On success: UPDATE portfolio_assets.current_price + last_price_updated_at
6. On success: UPSERT into portfolio_price_history (one record per day)
7. Return a PriceRefreshResult with per-asset success/failure status
```

**Staleness threshold:**

| Asset type | Threshold |
|------------|-----------|
| `STOCK` (`price_source = YAHOO`) | 15 minutes |
| `ETF` (`price_source = YAHOO`) | 15 minutes |
| `ETF` (`price_source = MFAPI`) | 24 hours |
| `EQUITY_MUTUAL_FUND` | 24 hours |
| `LIQUID_FUND` | 24 hours |

The service checks `last_price_updated_at` at profile open. If any asset is beyond its threshold, a refresh is triggered for that asset only. Manual refresh always bypasses the threshold check.

**Result type:**

```ts
interface PriceRefreshResult {
    refreshedCount: number
    skippedCount: number           // not stale
    failedAssets: { assetId: number; name: string; error: string }[]
    asOf: string                   // ISO 8601
}
```

Failed price fetches do not throw — they are collected into `failedAssets` so the UI can surface a partial-failure warning.

---

### 6.4 `src/services/portfolioAnalytics/portfolioAnalyticsService.ts`

Computed entirely in the main process. Never persisted.

**Responsibilities:**

| Method | Description |
|--------|-------------|
| `getPortfolioSummary()` | Queries `portfolio_summary` view; enriches with XIRR, CAGR, allocation percentages |
| `getAssetAnalytics(assetId)` | Single-asset breakdown: AVCO, P&L, CAGR, holding-period detail |
| `buildXirrCashFlows()` | Assembles cash flow array from all transactions + today's portfolio value as terminal inflow |

---

## 7. Price Provider Architecture

### 7.1 Interface — `src/services/priceUpdater/providers/priceProvider.ts`

```ts
interface PriceProvider {
    getLatestPrice(sourceId: string): Promise<number>
}
```

---

### 7.2 `yahooProvider.ts` — Stocks and exchange-traded ETFs

**npm package:** `yahoo-finance2` — pinned to exact version `3.14.1` (see §7.5 for pinning rationale)

- `sourceId` = full Yahoo Finance ticker including exchange suffix e.g. `INFY.NS`, `TCS.NS`, `NIFTYBEES.NS`
- `.NS` suffix = NSE — **real-time** per Yahoo Finance's own coverage table
- `.BO` suffix = BSE — 15-min delayed; use only if the stock is not NSE-listed
- Used for: `STOCK` and `ETF` with `price_source = YAHOO`

```ts
import yahooFinance from 'yahoo-finance2'

class YahooProviderImpl implements PriceProvider {
    async getLatestPrice(ticker: string): Promise<number> {
        const quote = await yahooFinance.quote(ticker)
        if (quote.regularMarketPrice == null) {
            throw new Error(`No price returned for ${ticker}`)
        }
        return quote.regularMarketPrice
    }
}
```

---

### 7.3 `mfapiProvider.ts` — Mutual funds and scheme-coded ETFs

**HTTP endpoint:** `https://api.mfapi.in/mf/{schemeCode}/latest` — no npm package; direct `fetch` only

- `sourceId` = AMFI scheme code e.g. `119551`, `125497`
- Used for: `EQUITY_MUTUAL_FUND`, `LIQUID_FUND`, `ETF` with `price_source = MFAPI`
- NAV updated 6× daily by AMFI: 10:05 AM, 2:05 PM, 6:05 PM, 9:05 PM, 3:09 AM, 5:05 AM IST
- No API key, no session management, no npm dependency

```ts
class MfapiProviderImpl implements PriceProvider {
    async getLatestPrice(schemeCode: string): Promise<number> {
        const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`)
        if (!res.ok) throw new Error(`mfapi returned ${res.status} for scheme ${schemeCode}`)
        const json = await res.json()
        return parseFloat(json.data[0].nav)     // e.g. "892.45600" → 892.456
    }
}
```

**Scheme code search** (for the asset creation UI): `GET https://api.mfapi.in/mf/search?q={name}`

---

### 7.4 Provider routing in `PriceUpdaterServiceImpl`

```ts
function getProvider(priceSource: PriceSource): PriceProvider {
    switch (priceSource) {
        case 'YAHOO': return yahooProvider
        case 'MFAPI': return mfapiProvider
    }
}
```

Each provider is instantiated once at service construction and reused across all refreshes.

---

### 7.5 Dependency version pinning

Supply chain attacks against npm have been active throughout 2026 (TanStack breach May 11 affected 42 packages via stolen CI/CD tokens; over 400 packages compromised across the ecosystem). Both packages used by this module must be pinned to exact versions with no semver ranges.

**`package.json` (root):**

```json
{
  "dependencies": {
    "yahoo-finance2": "3.14.1",
    "xirr": "1.1.0"
  }
}
```

No `^` or `~` prefixes. Any version bump is a deliberate, reviewed decision — not automatic.

**Why these versions are safe to pin:**

| Package | Pinned version | Published | Weekly downloads | Dep count | Notes |
|---------|---------------|-----------|-----------------|-----------|-------|
| `yahoo-finance2` | `3.14.1` | May 2026 | 158K | 5 | Actively maintained; reviewed before pinning |
| `xirr` | `1.1.0` | Nov 2020 | 44.6K | 1 | Unmaintained but stable; no new versions since 2020 is a security positive |

**MFAPI has no npm package** — it is a plain HTTPS REST API called via Node's built-in `fetch`. Zero supply chain surface for that data source.

**`.npmrc` hardening** (add to root `.npmrc`):

```ini
save-exact=true
```

This ensures any future `npm install <pkg>` records the exact version instead of a range.

**Additional practices:**
- Commit `package-lock.json`. Use `npm ci` (not `npm install`) in any script or CI context — it verifies the integrity hash of every installed package against the lockfile.
- Run `npm audit` before each version bump review.
- Review the full dependency tree of any new package before adding it (`npm ls --all`).

---

### 7.6 Data source summary

| Source | Type | Auth | Delay | Covers |
|--------|------|------|-------|--------|
| `yahoo-finance2@3.14.1` | npm (pinned) | None | Real-time (NSE .NS) / 15 min (BSE .BO) | Stocks, exchange-traded ETFs |
| `mfapi.in` | REST API (no npm) | None | ~2–4 hrs | All AMFI-registered MFs + ETFs |

**Adding a new provider:**
1. Implement `PriceProvider` in `src/services/priceUpdater/providers/`
2. Add the new value to the `PriceSource` type in `src/types/portfolioAsset.ts`
3. Add the routing case in `getProvider()`
4. Pin the new package to an exact version in `package.json` before merging
5. No schema migration required

---

## 8. Price Refresh Strategy

### On Profile Open

`profileService.openProfile()` already calls `recurringTransactionService.processRecurringTransactions()` after migration. The price refresh hook is added at the same point:

```ts
await priceUpdaterService.refreshStaleAssets()   // threshold-based, non-blocking
```

Because `better-sqlite3` is synchronous, the external HTTP calls in `priceUpdaterService` must be `async` (using `net.fetch` or `node-fetch` in the main process). The IPC handler awaits the result before returning to the renderer.

### Manual Refresh

The UI sends `portfolio:prices:refresh-all`. The handler calls `priceUpdaterService.refreshAll()`, which bypasses all staleness thresholds.

### Price History Write

Every successful price fetch runs:

```ts
priceRepository.upsertDailyPrice(assetId, price, currency, todayISO)
```

The `UNIQUE` index on `(portfolio_asset_id, recorded_date)` combined with `INSERT OR REPLACE` ensures exactly one record per asset per day. There is no TTL or cleanup — daily history is kept permanently. At one record/day × 20 assets, yearly growth is ~7 300 rows, which is negligible.

---

## 9. Analytics Layer

All values are computed on-demand in `PortfolioAnalyticsServiceImpl`. Nothing is persisted.

### 9.1 AVCO Cost Basis

AVCO (Weighted Average Cost) is computable directly from the `portfolio_summary` view:

```
avco         = total_acquisition_cost / total_units_acquired
cost_basis   = avco × total_units
```

The view already emits `avco` and `cost_basis` columns (see §3.5). The service reads these directly.

**Why AVCO and not FIFO:**
AVCO is the method mandated by SEBI for mutual fund redemptions and is the most common approach for stocks in India. FIFO would require a sequential lot-matching algorithm and cannot be expressed in a SQL view.

---

### 9.2 P&L

| Metric | Formula |
|--------|---------|
| Unrealized P&L | `total_units × current_price − cost_basis` |
| Unrealized P&L % | `(unrealized_pl / cost_basis) × 100` |
| Realized P&L | `total_sale_proceeds − (total_units_sold × avco)` |
| Total P&L | `unrealized_pl + realized_pl` |

Both are provided by `portfolio_summary` view. Service enriches with percentages.

---

### 9.3 XIRR

Uses the [`xirr`](https://www.npmjs.com/package/xirr) npm package.

**Cash flow construction for portfolio XIRR:**

```ts
const flows: XirrCashFlow[] = []

// All buy/SIP transactions → negative cash flows (money out)
for (const t of allTransactions) {
    if (['BUY', 'SIP'].includes(t.transactionType)) {
        flows.push({ amount: -(t.quantity * t.pricePerUnit + t.fees + t.taxes), date: t.transactionDate })
    }
    if (['SELL', 'REDEMPTION'].includes(t.transactionType)) {
        flows.push({ amount: t.quantity * t.pricePerUnit - t.fees - t.taxes, date: t.transactionDate })
    }
    if (t.transactionType === 'DIVIDEND' && !t.isDividendReinvestment) {
        flows.push({ amount: t.quantity * t.pricePerUnit, date: t.transactionDate })
    }
}

// Terminal inflow: today's total portfolio value
flows.push({ amount: totalCurrentValue, date: new Date() })

const portfolioXirr = xirr(flows.map(f => ({ amount: f.amount, when: f.date })))
```

XIRR returns `null` if there are fewer than 2 cash flows or if the solver fails to converge.

---

### 9.4 CAGR

Per-asset CAGR based on first buy date and current value:

```ts
const years = daysBetween(firstBuyDate, today) / 365.25
const cagr = (currentValue / totalCostBasis) ** (1 / years) - 1
```

Returns `null` if `years < 1` (holding period under 1 year).

---

### 9.5 Allocation

```ts
asset.allocationPct = (asset.currentValue / totalPortfolioValue) * 100
```

Computed after all assets are loaded.

---

### 9.6 Day's Gain / Loss

Requires yesterday's closing price from `portfolio_price_history`. The service fetches the most recent historical record *before* today for each asset.

```ts
const yesterdayPrice = priceRepository.getLatestBefore(assetId, todayISO)

if (yesterdayPrice != null) {
    dayGainLoss    = totalUnits * (currentNav - yesterdayPrice)
    dayGainLossPct = (currentNav - yesterdayPrice) / yesterdayPrice * 100
} else {
    dayGainLoss    = null   // no history yet — first day after adding asset
    dayGainLossPct = null
}
```

Portfolio-level `dayGainLoss` = sum of all per-asset day gains. `dayGainLossPct` = total day gain / total yesterday value.

This query must be added to `PortfolioPriceRepositoryImpl`:

```ts
getLatestBefore(assetId: number, beforeDate: string): number | null
// SELECT price FROM portfolio_price_history
// WHERE portfolio_asset_id = ? AND recorded_date < ?
// ORDER BY recorded_date DESC LIMIT 1
```

---

### 9.7 Allocation Breakdown

```ts
const allocation: AllocationBreakdown = {
    byAsset: assets.map(a => ({
        assetId: a.assetId,
        name: a.name,
        value: a.currentValue,
        pct: a.allocationPct,
    })),
    byType: groupAndSum(assets, a => a.type),
    byCategory: groupAndSum(assets, a => a.category),
}
```

`byAsset` feeds the pie chart. `byType` (EQUITY_MUTUAL_FUND, LIQUID_FUND, STOCK, ETF) and `byCategory` (EQUITY, DEBT) feed the category-level breakdown charts. These are always included in `PortfolioSummaryAnalytics.allocation` — no separate IPC call needed.

---

### 9.8 Per-asset XIRR

XIRR can be computed per-asset as well as portfolio-wide. For a single fund:

```ts
const flows = assetTransactions.map(t => {
    if (['BUY', 'SIP'].includes(t.transactionType))
        return { amount: -(t.quantity * t.pricePerUnit + t.fees + t.taxes), when: new Date(t.transactionDate) }
    if (['SELL', 'REDEMPTION'].includes(t.transactionType))
        return { amount: t.quantity * t.pricePerUnit - t.fees - t.taxes, when: new Date(t.transactionDate) }
    return null
}).filter(Boolean)

flows.push({ amount: asset.currentValue, when: new Date() })  // terminal value

asset.xirr = xirr(flows)   // null if solver fails
```

Per-asset XIRR is included in `AssetAnalytics` and returned by `portfolio:analytics:asset`.

---

## 10. SIP Integration with Recurring Transactions

SIPs reuse the existing `recurring_transactions` infrastructure via Migration 11.

**Data model:** A recurring transaction with `portfolio_asset_id IS NOT NULL` is a portfolio SIP. The `account_id` field (already required) represents the bank/savings account debited on each SIP cycle.

**Processing flow** (extended in `RecurringTransactionServiceImpl.processRecurringTransactions()`):

```
For each due recurring transaction:
  IF portfolio_asset_id IS NOT NULL:
    1. Fetch current_price for the asset from portfolio_assets
    2. Calculate quantity = amount / current_price  (units purchased at today's NAV/price)
    3. Create portfolio_transaction(type=SIP, quantity, price_per_unit=current_price, linked_recurring_id=id)
    4. Create regular transaction(type=withdraw, account_id, amount) on the linked Laxmi account
    5. Mark recurring_transaction next_due_date as processed
  ELSE:
    existing behaviour (create regular transaction only)
```

**Edge case — price unavailable at SIP time:** If `current_price IS NULL` (never refreshed), the SIP processing skips that asset and logs an error. The user must trigger a manual price refresh before the SIP can be processed.

---

## 11. Laxmi Account Linkage

`portfolio_transactions.linked_account_id` is a nullable FK to `accounts(account_id)`.

| Scenario | Behaviour |
|----------|-----------|
| Cash dividend (`isDividendReinvestment = false`) with `linked_account_id` set | `PortfolioTransactionService` calls `TransactionServiceImpl.createTransaction(deposit, amount, account_id)` automatically |
| Sell proceeds with `linked_account_id` set | Same — creates a `deposit` on the linked account |
| SIP debit (via recurring system) | Creates a `withdraw` on `account_id` of the recurring_transaction |
| No `linked_account_id` set | Portfolio transaction is recorded; no Laxmi account entry created |

Linking is optional in all cases. Net worth calculation on the Home page can aggregate Laxmi accounts + portfolio current value once the portfolio summary IPC is added to the home data fetch.

---

## 12. IPC Channels

All channels use `portfolio:` namespace for consistency with `budget:` and `recurring:` channels.

### Assets

| Channel | Handler Arguments | Returns |
|---------|-------------------|---------|
| `portfolio:asset:create` | `CreatePortfolioAssetRequest` | `PortfolioAsset` |
| `portfolio:asset:update` | `{ id: number, request: UpdatePortfolioAssetRequest }` | `PortfolioAsset` |
| `portfolio:asset:deactivate` | `{ id: number }` | `void` |
| `portfolio:asset:list` | — | `PortfolioAsset[]` |
| `portfolio:asset:get` | `{ id: number }` | `PortfolioAsset` |

### Fund Discovery

| Channel | Handler Arguments | Returns | Notes |
|---------|-------------------|---------|-------|
| `portfolio:mfapi:search` | `{ query: string }` | `MfSearchResult[]` | Calls `https://api.mfapi.in/mf/search?q={query}`; used in the Buy dialog to find a fund by name and resolve its scheme code before creating the asset |

### Transactions

| Channel | Handler Arguments | Returns |
|---------|-------------------|---------|
| `portfolio:transaction:create` | `CreatePortfolioTransactionRequest` | `PortfolioTransaction` |
| `portfolio:transaction:deactivate` | `{ id: number }` | `void` |
| `portfolio:transaction:list-by-asset` | `{ portfolioAssetId: number }` | `PortfolioTransaction[]` |

### Analytics

| Channel | Handler Arguments | Returns | Notes |
|---------|-------------------|---------|-------|
| `portfolio:analytics:summary` | — | `PortfolioSummaryAnalytics` | Includes allocation breakdown and day gain/loss; primary data source for the portfolio dashboard |
| `portfolio:analytics:asset` | `{ assetId: number }` | `AssetAnalytics` | Full detail for a single asset including per-asset XIRR, CAGR, NAV history |
| `portfolio:analytics:nav-history` | `{ assetId: number, fromDate: string, toDate: string }` | `{ date: string; nav: number }[]` | Queries `portfolio_price_history`; powers the NAV chart on the asset detail page |

### Price Management

| Channel | Handler Arguments | Returns |
|---------|-------------------|---------|
| `portfolio:prices:refresh-all` | — | `PriceRefreshResult` |
| `portfolio:prices:refresh-asset` | `{ assetId: number }` | `PriceRefreshResult` |

---

## 13. `preload.ts` Additions

```ts
portfolio: {
    asset: {
        create:     (request) => ipcRenderer.invoke('portfolio:asset:create', request),
        update:     (id, request) => ipcRenderer.invoke('portfolio:asset:update', { id, request }),
        deactivate: (id) => ipcRenderer.invoke('portfolio:asset:deactivate', { id }),
        list:       () => ipcRenderer.invoke('portfolio:asset:list'),
        get:        (id) => ipcRenderer.invoke('portfolio:asset:get', { id }),
    },
    mfapi: {
        search: (query) => ipcRenderer.invoke('portfolio:mfapi:search', { query }),
    },
    transaction: {
        create:       (request) => ipcRenderer.invoke('portfolio:transaction:create', request),
        deactivate:   (id) => ipcRenderer.invoke('portfolio:transaction:deactivate', { id }),
        listByAsset:  (portfolioAssetId) => ipcRenderer.invoke('portfolio:transaction:list-by-asset', { portfolioAssetId }),
    },
    analytics: {
        summary:    () => ipcRenderer.invoke('portfolio:analytics:summary'),
        asset:      (assetId) => ipcRenderer.invoke('portfolio:analytics:asset', { assetId }),
        navHistory: (assetId, fromDate, toDate) => ipcRenderer.invoke('portfolio:analytics:nav-history', { assetId, fromDate, toDate }),
    },
    prices: {
        refreshAll:   () => ipcRenderer.invoke('portfolio:prices:refresh-all'),
        refreshAsset: (assetId) => ipcRenderer.invoke('portfolio:prices:refresh-asset', { assetId }),
    },
}
```

`renderer/src/types/global.d.ts` must be updated to reflect the full `portfolio` namespace.

---

## 14. Files to Create / Modify

### New files

| File | Purpose |
|------|---------|
| `src/migrations/8-create_portfolio_assets.ts` | Creates `portfolio_assets` table and indexes |
| `src/migrations/9-create_portfolio_transactions.ts` | Creates `portfolio_transactions` table, `portfolio_holdings` view, `portfolio_summary` view, and indexes |
| `src/migrations/10-create_portfolio_price_history.ts` | Creates `portfolio_price_history` table and unique index |
| `src/migrations/11-extend_recurring_portfolio_sip.ts` | Alters `recurring_transactions` to add `portfolio_asset_id` column |
| `src/migrations/12-add_metadata_to_accounts.ts` | `ALTER TABLE accounts ADD COLUMN metadata TEXT` — adds optional JSON metadata to all accounts |
| `src/types/portfolioAsset.ts` | `PortfolioAsset`, `AssetCategory`, `AssetType`, `PriceSource`, create/update DTOs |
| `src/types/portfolioTransaction.ts` | `PortfolioTransaction`, `PortfolioTransactionType`, create DTO |
| `src/types/portfolioAnalytics.ts` | `AssetAnalytics`, `PortfolioSummaryAnalytics`, `XirrCashFlow`, `PriceRefreshResult` |
| `src/repository/portfolioAsset/portfolioAssetRepository.ts` | Interface + `PortfolioAssetRepositoryImpl` |
| `src/repository/portfolioTransaction/portfolioTransactionRepository.ts` | Interface + `PortfolioTransactionRepositoryImpl` |
| `src/repository/portfolioPrice/portfolioPriceRepository.ts` | Interface + `PortfolioPriceRepositoryImpl` |
| `src/services/portfolio/portfolioAssetService.ts` | Interface + `PortfolioAssetServiceImpl` |
| `src/services/portfolio/portfolioTransactionService.ts` | Interface + `PortfolioTransactionServiceImpl` |
| `src/services/priceUpdater/priceUpdaterService.ts` | Interface + `PriceUpdaterServiceImpl` |
| `src/services/priceUpdater/providers/priceProvider.ts` | `PriceProvider` interface |
| `src/services/priceUpdater/providers/yahooProvider.ts` | `YahooProviderImpl` |
| `src/services/priceUpdater/providers/mfapiProvider.ts` | `MfapiProviderImpl` |
| `src/services/portfolioAnalytics/portfolioAnalyticsService.ts` | Interface + `PortfolioAnalyticsServiceImpl` |
| `renderer/src/pages/portfolio/PortfolioPage.tsx` + `.css` | Main portfolio page |
| `renderer/src/pages/portfolio/AssetDialog.tsx` + `.css` | Add/edit asset dialog |
| `renderer/src/pages/portfolio/TransactionDialog.tsx` + `.css` | Log transaction dialog |

### Modified files

| File | What changes |
|------|-------------|
| `src/services/recurringTransaction/recurringTransactionService.ts` | Extend `processRecurringTransactions` to handle SIPs (`portfolio_asset_id IS NOT NULL`) |
| `src/types/account.ts` | Add `metadata: Record<string, unknown> \| null` to `Account`, `CreateAccountRequest`, `UpdateAccountRequest` |
| `src/repository/account/accountRepository.ts` | Serialize/deserialize `metadata` JSON in INSERT, UPDATE, SELECT |
| `renderer/src/pages/accounts/AccountDialog.tsx` | Show optional brokerage fields when `sub_type = 'investment'` |
| `main.ts` | Register all `portfolio:*` IPC handlers; instantiate new services |
| `preload.ts` | Add `portfolio` namespace to `contextBridge.exposeInMainWorld` |
| `renderer/src/types/global.d.ts` | Add full `portfolio` API type declaration |
| `renderer/src/types/navigation.ts` | Add `portfolio` page to navigation type |
| `renderer/src/components/layout/Sidebar.tsx` | Add Portfolio nav item |
| `renderer/src/App.tsx` | Register portfolio page route |
| `package.json` | Add `xirr` (or equivalent) npm dependency |

---

## 15. Design Decisions

Decision: `metadata TEXT` is added to `accounts` via a new migration; v1 only stores `{ "brokerage": "Zerodha" }`.
Reason: Broker identity doesn't warrant a dedicated column now, but the JSON field keeps the door open for account numbers and broker API keys without another migration.
Impact: `AccountSubType.Investment` accounts carry `metadata.brokerage`; all other subtypes leave `metadata = null`; no existing account query is affected.

Decision: All portfolio tables use `portfolio_` prefix.
Reason: Avoids collision with the existing `transactions` table used for expense tracking.
Impact: All queries and IPC channels are unambiguous about which domain they operate on.

Decision: `portfolio_holdings` and `portfolio_summary` are SQL views, not tables.
Reason: Holdings are always derivable from transactions; storing them risks stale-data bugs.
Impact: No separate "sync holdings" job needed; correctness is guaranteed by the SQL engine.

Decision: AVCO is computed in `portfolio_summary` view using aggregate SQL.
Reason: AVCO does not require sequential lot-matching; aggregate cost / aggregate units is equivalent.
Impact: Realized P&L is an approximation for assets with partial sells at varying prices, but matches SEBI convention.

Decision: Price history uses `INSERT OR REPLACE` with a unique index on `(asset_id, date)`.
Reason: Ensures daily granularity without a separate deduplication job.
Impact: Re-running a refresh on the same day replaces the existing record rather than creating a duplicate.

Decision: `yahoo-finance2` is used for stocks and exchange-traded ETFs despite being an unofficial community API.
Reason: No free, key-free, officially supported Indian stock price API exists for local desktop apps; `yahoo-finance2` is the most mature npm wrapper with 158K weekly downloads and NSE real-time coverage.
Impact: Price fetching can fail silently; the `PriceRefreshResult.failedAssets` array surfaces failures to the user without crashing.

Decision: All npm dependencies are pinned to exact versions with no semver ranges.
Reason: Active supply chain attacks in 2026 (TanStack breach, TeamPCP campaigns) have compromised packages with valid provenance; exact pinning prevents automatic ingestion of malicious updates.
Impact: Version upgrades are manual and deliberate; `npm ci` + `package-lock.json` integrity hashes enforce the pin at install time.

Decision: SIPs reuse `recurring_transactions` via a new `portfolio_asset_id` column.
Reason: The existing frequency/scheduling/processing infrastructure is identical to what a SIP needs.
Impact: `RecurringTransactionServiceImpl` grows a conditional branch; the schema change requires Migration 11.

Decision: XIRR is computed using an npm package, not implemented from scratch.
Reason: Newton-Raphson convergence edge cases (sign-change requirements, near-zero rates) are non-trivial.
Impact: Adds one production dependency; `xirr` returns `null` on non-convergence which the service propagates cleanly.

Decision: `currency` column added to `portfolio_assets` and `portfolio_transactions` but v1 analytics are INR-only.
Reason: Adding currency retroactively requires a migration; adding it now with `DEFAULT 'INR'` costs nothing.
Impact: Multi-currency analytics can be layered on top without schema changes.

---

## 16. v1 Scope

### Use case 1: Buying an asset (primary workflow)

| Requirement | How it is met |
|------------|---------------|
| Find a mutual fund by name | `portfolio:mfapi:search` → scheme code from MFAPI |
| Invest a rupee amount (not units) | `investedAmount` field on request; service derives units = amount / NAV |
| Debit from a checking/savings account atomically | `linkedAccountId` → atomic `withdraw` on Laxmi account |
| Direct investment (no linked account) | `linkedAccountId = null` |
| Set up a monthly SIP | Reuse `recurring_transactions` with `portfolio_asset_id` set; processed on profile open |
| Record the NAV at time of purchase | `pricePerUnit` on the transaction row; permanent record |

### Use case 2: Tracking assets (primary dashboard)

| Requirement | How it is met |
|------------|---------------|
| Current value of each fund | `portfolio_summary` view: `total_units × current_price` |
| Current NAV | `portfolio_assets.current_price`, refreshed on profile open |
| Day's gain / loss (₹ and %) | §9.6: `total_units × (current_nav - yesterday_nav)` from price history |
| Total portfolio value | `PortfolioSummaryAnalytics.totalCurrentValue` |
| Unrealized P&L (₹ and %) | AVCO cost basis vs current value (§9.1, §9.2) |
| XIRR per fund + portfolio-wide | §9.3 and §9.8; `xirr@1.1.0` package |
| Allocation pie chart | `AllocationBreakdown` by asset, type, category (§9.7) |
| NAV history chart | `portfolio:analytics:nav-history` → `portfolio_price_history` |
| Automatic price refresh | On profile open for stale assets; manual refresh available |
| Price staleness indicator | `lastUpdatedAt` in `AssetAnalytics` → UI shows "as of X" |

### Use case 3: Selling an asset

| Requirement | How it is met |
|------------|---------------|
| Record a redemption | `transaction_type = REDEMPTION`, `quantity = units redeemed` |
| Credit proceeds to a Laxmi account | `linkedAccountId` → atomic `deposit` on Laxmi account |
| See realized P&L after sell | `portfolio_summary` view: `total_sale_proceeds − (total_units_sold × avco)` |
| XIRR updates automatically | Computed fresh on each `portfolio:analytics:*` call |

### In scope (all three use cases)

- Asset types: `EQUITY_MUTUAL_FUND` (primary), `LIQUID_FUND`, `STOCK`, `ETF`
- Transaction types: `BUY`, `SELL`, `SIP`, `REDEMPTION`, `DIVIDEND`
- Amount-based (`investedAmount`) and unit-based (`quantity`) entry
- AVCO cost basis, unrealized P&L, realized P&L
- XIRR per-asset and portfolio-wide, CAGR per asset
- Day gain/loss
- Allocation breakdown (by asset, type, category)
- NAV history chart data
- MFAPI fund search by name
- Automatic + manual price refresh; price staleness indicator
- Daily price history
- SIP scheduling via recurring transactions
- Atomic Laxmi account linkage (debit on buy, credit on sell/dividend)

### Out of scope for v1

- Corporate actions (splits, bonus shares, rights issues, mergers)
- Multi-currency FX conversion in analytics
- FD, NPS, PPF, Gold (non-MF/stock/ETF asset types)
- Tax reporting (STCG/LTCG lot-level computation) — transaction history is preserved for this; see §17
- Fund switching as a first-class transaction type — covered by REDEMPTION + BUY in v1; see §17
- Closed positions history page
- Portfolio comparison benchmarks (vs Nifty 50, etc.)
- Rebalancing targets
- Import from broker statements (Zerodha, Groww, CAMS, etc.)

---

## 17. Extension Guidelines

### Adding a new asset type (e.g. `GOLD_ETF`, `FD`, `NPS`, `PPF`)

1. Add the new value to `AssetType` in `src/types/portfolioAsset.ts`.
2. Add provider routing in `PriceUpdaterServiceImpl` if a new price source is needed.
3. Document the `metadata` JSON shape for the new type in this file.
4. No schema migration required.

### Adding a new price provider (e.g. MCX for gold)

1. Implement `PriceProvider` in `src/services/priceUpdater/providers/`.
2. Add the new `PriceSource` value to the `PriceSource` type.
3. Add the routing case in `getProvider()`.
4. Pin the new npm package to an exact version. No schema migration required.

### Tax harvesting (LTCG / STCG)

**No schema change required.** Every `portfolio_transaction` row is already a tax lot:

| Field | Tax role |
|-------|---------|
| `transaction_date` | Acquisition date — determines holding period |
| `price_per_unit` | Acquisition NAV/price — determines cost per lot |
| `quantity` | Units in this lot |
| `transaction_type` | `BUY` / `SIP` = acquisition; `SELL` / `REDEMPTION` = disposal |

To add tax harvesting:
1. Add a `TaxAnalyticsServiceImpl` that reads raw transactions (not the AVCO view) and applies **FIFO lot-matching** for LTCG/STCG: oldest lots are assumed sold first.
2. LTCG threshold for equity in India: held > 1 year → LTCG at 10% on gains above ₹1L. Held ≤ 1 year → STCG at 15%.
3. Add `portfolio:analytics:tax-preview` IPC channel returning per-lot disposal analysis.
4. The AVCO views remain untouched — AVCO is for P&L reporting, FIFO is for tax reporting.

> AVCO and FIFO will give different numbers. This is expected and correct. AVCO is used for all P&L displayed in the UI; FIFO is used exclusively in the tax module.

### Fund switching / asset rolling

A "switch" moves money from Fund A to Fund B in a single AMC instruction. In v1 this is recorded as two transactions (REDEMPTION from A, BUY into B). To promote these to a first-class `SWITCH` in the future:

1. Add `SWITCH` to `PortfolioTransactionType`.
2. Add a nullable `switch_group_id TEXT` column to `portfolio_transactions` (new migration). Both legs of the switch share the same `switch_group_id`.
3. The `portfolio_holdings` view treats `SWITCH` as REDEMPTION for the source asset and BUY for the destination — requires view update.
4. Analytics can then identify switch pairs and compute the net tax event correctly.

> In v1, users can note the link in the `note` field of both transactions. No migration needed until the feature is built.

### Rebalancing targets

Add a `portfolio_targets` table (future migration):

```sql
CREATE TABLE portfolio_targets (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id     INTEGER REFERENCES portfolio_assets(id),
    target_pct   REAL NOT NULL,       -- desired allocation %
    tolerance    REAL NOT NULL DEFAULT 5.0,  -- drift band before rebalance alert
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_on   TEXT NOT NULL,
    modified_on  TEXT NOT NULL
);
```

`PortfolioAnalyticsServiceImpl` can then compute `actual_pct - target_pct` per asset and surface "over/under" alerts. The `AllocationBreakdown` type already carries `pct` per asset — adding target comparison is additive.

### Broker statement import (CAMS / Zerodha / Groww)

The transaction model is already import-ready:
- Each imported transaction maps to one `portfolio_transaction` row
- `note` can store the broker reference number
- CAMS consolidated statement format (PDF/CSV) can be parsed into `CreatePortfolioTransactionRequest[]`
- Add a `portfolio:import:cams-csv` IPC channel analogous to the existing `csv-import-confirm` channel

### Benchmark comparison (vs Nifty 50)

1. Add a `benchmark_assets` table or reuse `portfolio_assets` with `type = INDEX`.
2. Store Nifty 50 daily closes in `portfolio_price_history` under the benchmark asset.
3. `PortfolioAnalyticsServiceImpl` computes portfolio NAV index (starting at 100) vs benchmark NAV index over the same period.
4. `portfolio:analytics:benchmark` IPC channel returns the time-series comparison.

### Adding multi-currency analytics

1. Add a `fx_rates` table or a static in-memory rates map for the base conversion.
2. Extend `portfolio_summary` view to convert `current_price * fx_rate` to INR base.
3. `currency` column is already present on `portfolio_assets` and `portfolio_transactions` — no migration needed.

### Adding corporate actions (splits, bonus)

1. Add `SPLIT` and `BONUS` to `PortfolioTransactionType`.
2. A `SPLIT` transaction: `quantity = units_delta` (positive), `price_per_unit = 0`, `metadata` contains the ratio.
3. The `portfolio_holdings` view must be updated — add SPLIT/BONUS to the acquisition CASE branch.
4. This is the most invasive extension and requires a view migration. Leave for post-v1.
