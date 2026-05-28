# Portfolio Tracker — Implementation Phases

Five phases that stack cleanly. Each phase ends with something runnable and testable before the next begins.

```
Phase 1  ──►  Phase 2  ──►  Phase 3  ──►  Phase 4  ──►  Phase 5
Schema        CRUD +         Price          Analytics      SIP
Foundation    Basic UI       Providers      Dashboard      Integration
```

---

## Phase 1 — Schema Foundation

**Goal:** Database schema, TypeScript types, and repository layer exist and are tested. No services, no IPC, no UI.

**Why first:** Every subsequent phase depends on this. Getting the schema right now avoids the most expensive kind of rework (view migrations, broken tests).

---

### Plan

Deliver:
- Migrations 8, 9, 10 (all three portfolio tables + views + indexes)
- Three TypeScript type files
- Three repository implementations with unit tests

Do not build: services, IPC handlers, any UI.

---

### Build

#### Step 1 — Migrations

**`src/migrations/8-create_portfolio_assets.ts`**

```ts
export function up(db: SQLiteDatabase): void {
    db.exec(`
        CREATE TABLE portfolio_assets (
            id                    INTEGER PRIMARY KEY AUTOINCREMENT,
            name                  TEXT NOT NULL,
            category              TEXT NOT NULL,
            type                  TEXT NOT NULL,
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

**`src/migrations/9-create_portfolio_transactions.ts`**

Creates `portfolio_transactions` table + `portfolio_holdings` view + `portfolio_summary` view. See §3.2, §3.4, §3.5 of `portfolio-tracker.md` for the exact SQL.

**`src/migrations/10-create_portfolio_price_history.ts`**

Creates `portfolio_price_history` table + unique index on `(portfolio_asset_id, recorded_date)`. See §3.3.

#### Step 2 — TypeScript Types

Create the three files exactly as specified in §4 of `portfolio-tracker.md`:

| File | Contents |
|------|----------|
| `src/types/portfolioAsset.ts` | `AssetCategory`, `AssetType`, `PriceSource`, `PortfolioAsset`, `CreatePortfolioAssetRequest`, `UpdatePortfolioAssetRequest` |
| `src/types/portfolioTransaction.ts` | `PortfolioTransactionType`, `PortfolioTransaction`, `CreatePortfolioTransactionRequest` (with both `quantity` and `investedAmount` fields) |
| `src/types/portfolioAnalytics.ts` | `AssetAnalytics`, `PortfolioSummaryAnalytics`, `AllocationBreakdown`, `XirrCashFlow`, `MfSearchResult`, `PriceRefreshResult` |

Add JSDoc `@module` / `@description` / `@stability` headers per the documentation rules.

#### Step 3 — Repository Implementations

Follow the existing pattern: `interface` + `*RepositoryImpl(db: SQLiteDatabase)`.

**`src/repository/portfolioAsset/portfolioAssetRepository.ts`**

Methods: `create`, `update`, `deactivate`, `getById`, `listActive`, `listByPriceSource`, `updatePrice`

**`src/repository/portfolioTransaction/portfolioTransactionRepository.ts`**

Methods: `create`, `deactivate`, `listByAsset`, `listAll`, `getHoldings` (queries `portfolio_holdings` view), `getSummary` (queries `portfolio_summary` view)

**`src/repository/portfolioPrice/portfolioPriceRepository.ts`**

Methods: `upsertDailyPrice` (INSERT OR REPLACE), `getHistoryByAsset`, `getLatestBefore` (for day gain/loss)

---

### Test

Create test files alongside each repository (`.test.ts`). Use the same pattern as `src/repository/account/accountRepository.test.ts` — open an in-memory SQLite database, run migrations 1–10, then exercise each method.

**`portfolioAssetRepository.test.ts` — key cases:**
- [ ] `create` inserts a row and returns the full `PortfolioAsset` object
- [ ] `listActive` excludes deactivated assets
- [ ] `listByPriceSource('MFAPI')` only returns MFAPI assets
- [ ] `updatePrice` sets `current_price` and `last_price_updated_at`
- [ ] `deactivate` sets `is_active = 0`; subsequent `getById` still returns the row

**`portfolioTransactionRepository.test.ts` — key cases:**
- [ ] `create` correctly persists `quantity`, `price_per_unit`, `fees`, `taxes`, dates
- [ ] `getHoldings` view: two BUY transactions → `total_units` = sum of both quantities
- [ ] `getHoldings` view: BUY then partial SELL → correct net units
- [ ] `getSummary` view: AVCO = `total_acquisition_cost / total_units_acquired`
- [ ] `getSummary` view: `unrealized_pl` = `total_units * current_price - cost_basis`
- [ ] `getSummary` view: fully-exited position (total_units = 0) is excluded
- [ ] `deactivate` excludes the transaction from `portfolio_holdings` (WHERE is_active = 1)

**`portfolioPriceRepository.test.ts` — key cases:**
- [ ] `upsertDailyPrice` inserts on first call
- [ ] `upsertDailyPrice` replaces (no duplicate) on same asset + same date
- [ ] `upsertDailyPrice` creates a new row for a different date
- [ ] `getLatestBefore` returns the most recent record strictly before the given date
- [ ] `getLatestBefore` returns `null` when no history exists

---

### Verify (Definition of Done)

- [ ] `npm test` passes with all repository tests green
- [ ] Migrations 8, 9, 10 run cleanly in sequence from a fresh DB (`npm run dev` opens the app without errors)
- [ ] No TypeScript compiler errors (`tsc --noEmit`)
- [ ] The `portfolio_summary` view correctly excludes fully-exited positions (verified by a manual SQL query against a test DB)

---

## Phase 2 — Asset & Transaction CRUD + Basic UI

**Goal:** User can search for a mutual fund by name, add it to their portfolio, log a BUY transaction, and see the fund in a list. The debit to a bank account is optional — the same flow covers ESOPs, employer-matched contributions, and assets already owned with no cash movement to track.

**Depends on:** Phase 1 complete.

---

### Plan

Deliver:
- `portfolioAssetService` and `portfolioTransactionService`
- All CRUD IPC handlers + preload additions
- MFAPI search IPC
- Basic `PortfolioPage` with asset list
- `AssetDialog` (add/edit asset)
- `TransactionDialog` (log BUY / SELL)

Do not build: price refresh, analytics, charts.

---

### Build

#### Step 0 — Migration 12 + AccountDialog redesign

##### Migration 12

**`src/migrations/12-add_metadata_to_accounts.ts`**

```ts
export function up(db: SQLiteDatabase): void {
    db.exec(`ALTER TABLE accounts ADD COLUMN metadata TEXT;`)
}
```

Backward-compatible `ALTER TABLE ADD COLUMN`. All existing rows get `metadata = NULL`. No existing query breaks.

**Update `src/types/account.ts`:**

```ts
export interface Account {
    // ...existing fields unchanged...
    metadata: Record<string, unknown> | null
}
export interface CreateAccountRequest {
    // ...existing fields unchanged...
    metadata?: Record<string, unknown>
}
export interface UpdateAccountRequest {
    // ...existing fields unchanged...
    metadata?: Record<string, unknown>
}
```

**Metadata shape for `sub_type = 'investment'`:**

```json
{ "brokerage": "Zerodha" }
```

Just the broker name for now. The column is future-extensible (API keys, account numbers for broker import) without another migration. Non-investment accounts leave `metadata = null`.

**Why `institution_name` is NOT used for broker name:**
`institution_name` is a generic display name already used for bank names. Keeping broker identity in `metadata.brokerage` keeps the two concerns separate and makes it queryable as a typed field later without a migration.

**Update `accountRepository`** — serialize `JSON.stringify(metadata)` on INSERT/UPDATE; deserialize `JSON.parse(metadata)` on SELECT. If the column is null, return `null`.

---

##### AccountDialog redesign

The current dialog has a broken `<Select>` that only renders `Checking`. This phase replaces it entirely with a **type selector strip** at the top.

**New layout:**

```
┌─────────────────────────────────────────────────┐
│  Add Account                                    │
├─────────────────────────────────────────────────┤
│  ┌──────────┬──────────┬────────┬───────────┐   │
│  │ Checking │  Savings │ Credit │ Investment │   │
│  └──────────┴──────────┴────────┴───────────┘   │
│                                                 │
│  [fields for selected type]                     │
│                                                 │
│              [Cancel]  [Add Account]            │
└─────────────────────────────────────────────────┘
```

The strip is a row of buttons (or styled radio inputs) — one per subtype. Clicking one sets `subType` state and shows the relevant fields below. `Salary` is removed from the visible tabs (it exists in the enum for legacy data but is not a type users create manually).

**Fields per type:**

| Tab | Fields shown |
|-----|-------------|
| Checking | Bank name, Account name, Color, Opened on |
| Savings | Bank name, Account name, Color, Opened on |
| Credit | Bank name, Card name, Color, Opened on |
| Investment | Broker *(maps to `institution_name`)*, Account name, Color, Opened on |

Investment accounts show **"Broker"** as the label for `institution_name` (e.g. "Zerodha", "Groww", "Angel One"). This value is also written to `metadata.brokerage` so the portfolio TransactionDialog can display it cleanly in the account dropdown.

**State shape in component:**

```ts
const [subType, setSubType] = useState<AccountSubType>(AccountSubType.Checking)
const [broker, setBroker] = useState('')         // investment only → institution_name + metadata.brokerage
```

**On submit for investment accounts:**

```ts
const request: CreateAccountRequest = {
    institution_name: broker.trim(),
    account_name: accountName.trim(),
    account_type: AccountType.Asset,
    sub_type: AccountSubType.Investment,
    color,
    opened_on: new Date(openedOn),
    metadata: { brokerage: broker.trim() },
}
```

---

#### Step 1 — Services

**`src/services/portfolio/portfolioAssetService.ts`**

Interface + `PortfolioAssetServiceImpl`. Key validation rules (from §6.1 of `portfolio-tracker.md`):
- `type = STOCK` → `priceSource` must be `YAHOO`
- `type = EQUITY_MUTUAL_FUND | LIQUID_FUND` → `priceSource` must be `MFAPI`
- `priceSource = YAHOO` → `metadata.ticker` must be present and end in `.NS` or `.BO`
- `priceSource = MFAPI` → `metadata.schemeCode` must be present
- Obtains DB from `profileSessionService.getDatabaseConnection()`; throws if no active profile

**`src/services/portfolio/portfolioTransactionService.ts`**

Interface + `PortfolioTransactionServiceImpl`. Key logic (from §6.2):
- Validates asset exists and is active
- If `investedAmount` is provided: `quantity = investedAmount / pricePerUnit`; throws if both or neither of `quantity`/`investedAmount` are present
- If `linkedAccountId` is set: wraps both writes in `db.transaction()`:
  - BUY/SIP → `TransactionServiceImpl.createTransaction(withdraw, linkedAccountId, amount)`
  - SELL/REDEMPTION → `TransactionServiceImpl.createTransaction(deposit, linkedAccountId, amount)`
  - DIVIDEND (cash) → `TransactionServiceImpl.createTransaction(deposit, linkedAccountId, dividendAmount)`
- Validates `linkedAccountId` account exists and is active before opening the transaction

**`src/services/portfolio/mfapiSearchService.ts`**

Single method: `search(query: string): Promise<MfSearchResult[]>`

```ts
const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`)
const json = await res.json()
return json.map((item: any) => ({
    schemeCode: String(item.schemeCode),
    schemeName: item.schemeName,
}))
```

#### Step 2 — IPC Handlers (`main.ts`)

Register handlers using `portfolio:` namespace:

```ts
// Assets
ipcMain.handle('portfolio:asset:create',     (_, req) => portfolioAssetService.create(req))
ipcMain.handle('portfolio:asset:update',     (_, { id, request }) => portfolioAssetService.update(id, request))
ipcMain.handle('portfolio:asset:deactivate', (_, { id }) => portfolioAssetService.deactivate(id))
ipcMain.handle('portfolio:asset:list',       () => portfolioAssetService.listActive())
ipcMain.handle('portfolio:asset:get',        (_, { id }) => portfolioAssetService.getById(id))

// Fund discovery
ipcMain.handle('portfolio:mfapi:search', (_, { query }) => mfapiSearchService.search(query))

// Transactions
ipcMain.handle('portfolio:transaction:create',        (_, req) => portfolioTransactionService.create(req))
ipcMain.handle('portfolio:transaction:deactivate',    (_, { id }) => portfolioTransactionService.deactivate(id))
ipcMain.handle('portfolio:transaction:list-by-asset', (_, { portfolioAssetId }) => portfolioTransactionService.listByAsset(portfolioAssetId))
```

#### Step 3 — `preload.ts` + `global.d.ts`

Add the `portfolio` namespace to `contextBridge.exposeInMainWorld`. Add full TypeScript declaration to `renderer/src/types/global.d.ts`. See §13 of `portfolio-tracker.md` for the exact shape (asset, mfapi, transaction namespaces only — prices and analytics come in later phases).

#### Step 4 — Navigation

- Add `'portfolio'` to the `Page` union type in `renderer/src/types/navigation.ts`
- Add Portfolio nav item to `renderer/src/components/layout/Sidebar.tsx`
- Register the route in `renderer/src/App.tsx`

#### Step 5 — UI Components

**`renderer/src/pages/portfolio/PortfolioPage.tsx`**

Layout:
```
┌─────────────────────────────────────────────────┐
│  Portfolio                          [+ Add Fund] │
├─────────────────────────────────────────────────┤
│  Fund name         Units    Invested    [+ Buy]  │
│  ─────────────────────────────────────────────── │
│  Parag Parikh...   123.45   ₹50,000    [+ Buy]  │
│  HDFC Top 100      89.12    ₹30,000    [+ Buy]  │
├─────────────────────────────────────────────────┤
│  (empty state when no assets)                   │
└─────────────────────────────────────────────────┘
```

No prices / analytics yet — those come in Phase 3 and 4. Show `--` for any field that requires a price.

**`renderer/src/pages/portfolio/AssetDialog.tsx`**

Two-step dialog for adding a mutual fund:
1. Step 1: Search field → calls `portfolio:mfapi:search` as user types (debounced 400ms) → shows list of results → user selects one
2. Step 2: Populated name + scheme code → user picks category (EQUITY / DEBT), confirms

For stocks/ETFs: manual ticker entry instead of search.

**`renderer/src/pages/portfolio/TransactionDialog.tsx`**

Fields:
- Transaction type: BUY (default) / SELL / DIVIDEND
- Date (defaults to today)
- Amount (₹) — primary input; units calculated below it in real-time as `amount / NAV` once current_price is available
- OR switch to "Enter units manually" toggle (used for ESOPs, existing holdings, employer grants)
- Price per unit (NAV) — pre-filled from `asset.current_price`; user can override
- Fees (optional)
- Debit from account: dropdown of Laxmi accounts **OR "No account (direct)"** — default is "No account (direct)". Investment accounts show their brokerage name from `metadata.brokerage` (e.g. "Zerodha — XZ1234") so the user can tell them apart from savings/checking accounts
- Note (optional)

The "No account (direct)" option is the default and covers:
- Company ESOP grants / vests
- Employer-matched fund contributions
- Adding assets you already own
- Any investment where cash movement is not tracked in Laxmi

Only select an account when money actually moved out of a tracked Laxmi account.

---

### Test

**`portfolioAssetService.test.ts` — key cases:**
- [ ] Creates EQUITY_MUTUAL_FUND with valid MFAPI metadata
- [ ] Rejects EQUITY_MUTUAL_FUND with `priceSource = YAHOO`
- [ ] Rejects YAHOO asset where `metadata.ticker` does not end in `.NS` or `.BO`
- [ ] Rejects when no active DB connection
- [ ] `deactivate` throws if asset not found

**`portfolioTransactionService.test.ts` — key cases:**
- [ ] BUY with `investedAmount = 5000` and `pricePerUnit = 50` → stored `quantity = 100`
- [ ] Throws if both `quantity` and `investedAmount` are provided
- [ ] Throws if neither `quantity` nor `investedAmount` is provided
- [ ] BUY with `linkedAccountId`: both `portfolio_transaction` and `transaction` (withdraw) are created atomically
- [ ] BUY with `linkedAccountId`: if Laxmi account transaction fails, portfolio transaction is also rolled back (atomicity test)
- [ ] BUY with no `linkedAccountId`: only `portfolio_transaction` is created; no `transaction` row
- [ ] SELL with `linkedAccountId`: creates a `deposit` (not `withdraw`) on the account
- [ ] Throws if asset is not found or is inactive
- [ ] Throws if `linkedAccountId` refers to a non-existent account

**Manual UI smoke test:**
- [ ] Search "Parag Parikh" in AssetDialog → results appear
- [ ] Select a fund → confirm → asset appears in PortfolioPage list
- [ ] Click `[+ Buy]` → TransactionDialog opens with fund pre-selected; default is "No account (direct)"
- [ ] Enter ₹5000, leave "No account (direct)" → submit → fund shows updated invested amount; no Laxmi account is touched
- [ ] Click `[+ Buy]` again, select "from HDFC Savings" → submit → fund shows updated invested amount; HDFC Savings account balance decreases by ₹5000
- [ ] Add a BUY with "Enter units manually" (ESOP scenario) → units stored correctly; no amount required

---

### Verify (Definition of Done)

- [ ] All service tests pass
- [ ] `tsc --noEmit` clean
- [ ] Can complete full buy flow end-to-end: search fund → add → buy with linked account → account balance debited
- [ ] Empty state renders correctly when no assets
- [ ] No crashes when profile has no assets

---

## Phase 3 — Price Providers

**Goal:** Assets show live NAV. Prices refresh automatically on profile open (if stale). User can trigger manual refresh. Price history accumulates daily.

**Depends on:** Phase 2 complete (assets and transactions must exist for price refresh to have something to update).

---

### Plan

Deliver:
- Install `yahoo-finance2@3.14.1` (pinned)
- `yahooProvider`, `mfapiProvider`, `priceUpdaterService`
- Auto-refresh hook in `profileService.openProfile()`
- Price IPC handlers
- `preload.ts` prices namespace
- UI: NAV column, "last updated" indicator, manual refresh button
- Price staleness handling in UI

---

### Build

#### Step 1 — Install Dependencies

```json
// package.json — add to dependencies (root, not renderer)
"yahoo-finance2": "3.14.1"
```

```ini
# .npmrc
save-exact=true
```

Run `npm install` then verify `package-lock.json` contains the exact version with its integrity hash.

#### Step 2 — Providers

**`src/services/priceUpdater/providers/priceProvider.ts`**

```ts
interface PriceProvider {
    getLatestPrice(sourceId: string): Promise<number>
}
```

**`src/services/priceUpdater/providers/yahooProvider.ts`**

```ts
import yahooFinance from 'yahoo-finance2'

export class YahooProviderImpl implements PriceProvider {
    async getLatestPrice(ticker: string): Promise<number> {
        const quote = await yahooFinance.quote(ticker)
        if (quote.regularMarketPrice == null)
            throw new Error(`No price returned for ${ticker}`)
        return quote.regularMarketPrice
    }
}
```

**`src/services/priceUpdater/providers/mfapiProvider.ts`**

```ts
export class MfapiProviderImpl implements PriceProvider {
    async getLatestPrice(schemeCode: string): Promise<number> {
        const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`)
        if (!res.ok) throw new Error(`mfapi ${res.status} for scheme ${schemeCode}`)
        const json = await res.json() as { data: { nav: string }[] }
        return parseFloat(json.data[0].nav)
    }
}
```

#### Step 3 — `PriceUpdaterServiceImpl`

Full logic from §6.3 and §8 of `portfolio-tracker.md`:

```
refreshStaleAssets():
  for each active asset:
    threshold = 15min (YAHOO) or 24hr (MFAPI)
    if last_price_updated_at is null OR now - last_price_updated_at > threshold:
      provider = getProvider(asset.priceSource)
      try:
        price = await provider.getLatestPrice(asset.priceSourceId)
        assetRepo.updatePrice(asset.id, price, now.toISOString())
        priceRepo.upsertDailyPrice(asset.id, price, 'INR', todayISO)
      catch e:
        failedAssets.push({ assetId: asset.id, name: asset.name, error: e.message })
  return PriceRefreshResult

refreshAll():
  same as above but skip the threshold check
```

#### Step 4 — Hook into Profile Open

In `profileService.ts`, after migrations and recurring transaction processing:

```ts
// Non-blocking — don't await; let it run in background
priceUpdaterService.refreshStaleAssets().catch(err =>
    console.error('Background price refresh failed:', err)
)
```

Because `better-sqlite3` is synchronous but price fetching is async, the IPC `open-profile` handler must be `async`. Verify this doesn't block profile open UX.

#### Step 5 — IPC Handlers

```ts
ipcMain.handle('portfolio:prices:refresh-all',   () => priceUpdaterService.refreshAll())
ipcMain.handle('portfolio:prices:refresh-asset', (_, { assetId }) => priceUpdaterService.refreshAsset(assetId))
```

#### Step 6 — UI Updates

- `PortfolioPage`: add NAV column showing `asset.current_price` formatted as `₹XX.XX`
- Add a "last updated" badge per asset: `"Updated 5 min ago"` if fresh, `"Stale — 3 hrs ago"` if beyond threshold (styled differently)
- Add a `[↻ Refresh]` button in the page header → calls `portfolio:prices:refresh-all`
- Show `failedAssets` in a dismissible warning banner if any failed

---

### Test

**`priceUpdaterService.test.ts`** — mock both providers:

- [ ] `refreshStaleAssets` skips assets whose `last_price_updated_at` is within threshold
- [ ] `refreshStaleAssets` refreshes assets with `last_price_updated_at = null`
- [ ] `refreshStaleAssets` refreshes assets past their threshold
- [ ] On successful refresh: `portfolio_assets.current_price` is updated; `portfolio_price_history` has a new row
- [ ] On provider error: asset is added to `failedAssets`; other assets are still refreshed (failure isolation)
- [ ] `upsertDailyPrice` on same day replaces, not duplicates (verify row count stays at 1)
- [ ] `refreshAll` ignores staleness thresholds and refreshes everything

**`yahooProvider.test.ts`** — mock `yahoo-finance2`:
- [ ] Returns `regularMarketPrice` from quote response
- [ ] Throws when `regularMarketPrice` is null

**`mfapiProvider.test.ts`** — mock `fetch`:
- [ ] Parses `data[0].nav` from response correctly
- [ ] Throws on non-200 status

**Manual smoke test:**
- [ ] Open profile → MFAPI assets update within seconds; check `last_price_updated_at` in SQLite
- [ ] Open profile again immediately → assets are not refreshed (within threshold)
- [ ] Click `[↻ Refresh]` → `refreshAll` is triggered regardless of threshold
- [ ] Disconnect network → refresh shows banner with failed assets; other assets unaffected

---

### Verify (Definition of Done)

- [ ] All price service and provider tests pass
- [ ] `tsc --noEmit` clean
- [ ] Assets show live NAV after profile open
- [ ] `portfolio_price_history` has one row per asset per day (no duplicates on re-open same day)
- [ ] Manual refresh works from UI
- [ ] Price staleness indicator visually distinguishes fresh vs stale assets

---

## Phase 4 — Analytics Dashboard

**Goal:** Full portfolio dashboard with current value, day gain/loss, total P&L, XIRR, allocation pie chart. Per-fund detail page with NAV history chart.

**Depends on:** Phase 3 complete (analytics requires `current_price` to be non-null for meaningful numbers).

---

### Plan

Deliver:
- `xirr@1.1.0` npm install (pinned)
- `portfolioAnalyticsService`
- Analytics IPC handlers (summary, asset, nav-history)
- `preload.ts` analytics namespace
- Portfolio dashboard UI with summary metrics + pie chart
- Asset detail view with NAV history chart

---

### Build

#### Step 1 — Install Dependencies

```json
"xirr": "1.1.0"
```

#### Step 2 — `PortfolioAnalyticsServiceImpl`

Full logic from §9 of `portfolio-tracker.md`. Key methods:

**`getPortfolioSummary(): PortfolioSummaryAnalytics`**

```
1. getSummary() from portfolioTransactionRepository → rows from portfolio_summary view
2. For each row:
   a. Calculate unrealizedPl, realizedPl, totalPl (already in view)
   b. Fetch yesterdayNav via priceRepository.getLatestBefore(assetId, todayISO)
   c. dayGainLoss = totalUnits * (currentNav - yesterdayNav) if yesterdayNav exists
   d. firstInvestmentDate = earliest transaction_date for this asset
   e. CAGR: years = daysBetween(firstInvestmentDate, today) / 365.25; only if years >= 1
   f. per-asset XIRR: build cash flows from transactions + terminal value
3. Sum totals across all assets
4. Portfolio XIRR: all transactions across all assets + total current value as terminal flow
5. Build AllocationBreakdown (byAsset, byType, byCategory)
6. Return PortfolioSummaryAnalytics
```

**`getAssetAnalytics(assetId): AssetAnalytics`**

Same as above but scoped to one asset.

**`getNavHistory(assetId, fromDate, toDate): { date: string; nav: number }[]`**

Direct query to `portfolio_price_history`.

**XIRR null-safety:**

```ts
import xirr from 'xirr'

function safeXirr(flows: { amount: number; when: Date }[]): number | null {
    if (flows.length < 2) return null
    try {
        return xirr(flows)
    } catch {
        return null     // solver failed to converge
    }
}
```

#### Step 3 — IPC Handlers

```ts
ipcMain.handle('portfolio:analytics:summary',     () => portfolioAnalyticsService.getPortfolioSummary())
ipcMain.handle('portfolio:analytics:asset',       (_, { assetId }) => portfolioAnalyticsService.getAssetAnalytics(assetId))
ipcMain.handle('portfolio:analytics:nav-history', (_, { assetId, fromDate, toDate }) =>
    portfolioAnalyticsService.getNavHistory(assetId, fromDate, toDate))
```

#### Step 4 — Portfolio Dashboard UI

Replace the plain list in `PortfolioPage` with a full dashboard:

**Summary bar** (top):
```
Total Value: ₹1,23,456     Today: +₹234 (+0.19%)     Total P&L: +₹12,345 (+11.2%)     XIRR: 14.3%
```

**Allocation pie chart** (ECharts, left panel):
- `byAsset` breakdown by default
- Toggle between "By Fund", "By Type", "By Category"
- Use the existing ECharts setup from `ReportsPage`

**Fund list** (right panel / below pie):

| Fund | Units | Invested | Current Value | P&L | Day | XIRR |
|------|-------|----------|---------------|-----|-----|------|
| PPFAS Flexi Cap | 123.45 | ₹50,000 | ₹56,789 | +₹6,789 (+13.6%) | +₹123 | 14.2% |

Clicking a fund opens an **asset detail view** (new route `portfolio-asset-detail`):
- NAV history line chart (30d / 1y / all time selector)
- All transactions list for this fund
- Full analytics for this fund (AVCO, XIRR, CAGR)

---

### Test

**`portfolioAnalyticsService.test.ts`** — use in-memory DB, run all migrations, seed data:

- [ ] `getPortfolioSummary` with one fund, one BUY: `totalCurrentValue = units * current_price`
- [ ] `getPortfolioSummary` AVCO: two BUYs at different NAVs → avco = total_cost / total_units
- [ ] `getPortfolioSummary` unrealized P&L: positive when current NAV > AVCO
- [ ] `getPortfolioSummary` realized P&L: SELL at NAV > AVCO → positive realized P&L
- [ ] `getPortfolioSummary` day gain/loss: null when no price history; correct value when yesterday's history exists
- [ ] XIRR: single BUY then immediate terminal value → XIRR is 0 (or close to it); positive return scenario → XIRR > 0
- [ ] `safeXirr` returns null for < 2 flows; returns null (does not throw) when solver fails
- [ ] CAGR: returns null when holding period < 1 year; correct value at exactly 2 years
- [ ] Allocation byType sums to 100%
- [ ] `getNavHistory` returns records filtered by date range in ascending order

**Manual smoke test:**
- [ ] Dashboard shows correct total value matching sum of individual fund values
- [ ] Pie chart renders and is interactive
- [ ] Day gain/loss is null/`--` on first day (no history), shows a value on subsequent days
- [ ] XIRR shows null for a brand-new fund with one transaction (terminal value = cost → 0%)
- [ ] NAV chart renders for a fund with multiple days of price history

---

### Verify (Definition of Done)

- [ ] All analytics service tests pass
- [ ] `tsc --noEmit` clean
- [ ] Dashboard loads within 1 second for a portfolio with up to 20 funds
- [ ] Pie chart renders with correct proportions
- [ ] XIRR and CAGR display correctly (or `--` when insufficient data)
- [ ] Clicking a fund navigates to the detail view with its NAV chart

---

## Phase 5 — SIP Integration

**Goal:** User can set up a monthly SIP for a mutual fund. On each due date (detected when profile opens), the system automatically logs the portfolio transaction and debits the linked bank account.

**Depends on:** Phase 3 complete (SIP processing needs `current_price` to derive units).

---

### Plan

Deliver:
- Migration 11 (`portfolio_asset_id` column on `recurring_transactions`)
- Extended `RecurringTransactionServiceImpl.processRecurringTransactions()`
- UI for setting up a portfolio SIP (extend existing `RecurringDialog`)

---

### Build

#### Step 1 — Migration 11

**`src/migrations/11-extend_recurring_portfolio_sip.ts`**

```ts
export function up(db: SQLiteDatabase): void {
    db.exec(`
        ALTER TABLE recurring_transactions
        ADD COLUMN portfolio_asset_id INTEGER REFERENCES portfolio_assets(id);
    `)
}
```

Update `RecurringTransaction` type in `src/types/recurringTransaction.ts`:

```ts
portfolioAssetId?: number | null
```

#### Step 2 — Extend `RecurringTransactionServiceImpl`

In `processRecurringTransactions()`, after fetching each due recurring transaction, add the portfolio branch:

```ts
if (recurringTxn.portfolioAssetId != null) {
    const asset = portfolioAssetRepository.getById(recurringTxn.portfolioAssetId)

    if (!asset || asset.currentPrice == null) {
        // Log error, skip this SIP — user must refresh prices first
        errors.push({ recurringId: recurringTxn.id, reason: 'Asset price unavailable' })
        continue
    }

    const quantity = recurringTxn.amount / asset.currentPrice

    // Wrap both writes atomically
    db.transaction(() => {
        portfolioTransactionService.create({
            portfolioAssetId: asset.id,
            transactionType: 'SIP',
            quantity,
            pricePerUnit: asset.currentPrice!,
            transactionDate: new Date(),
            linkedRecurringId: recurringTxn.id,
            linkedAccountId: recurringTxn.accountId,   // debit source account
        })
        // portfolioTransactionService.create already handles the withdraw
        // on linkedAccountId when the type is SIP
    })()
} else {
    // existing behaviour unchanged
}
```

#### Step 3 — Update `RecurringTransactionRepository`

Add `portfolioAssetId` to the INSERT and SELECT queries for `recurring_transactions`.

#### Step 4 — Update `RecurringDialog` UI

Add an optional "Link to portfolio fund" toggle:
- When enabled: shows a fund selector dropdown (calls `portfolio:asset:list`)
- The selected fund's `id` is sent as `portfolioAssetId` on create/update
- The `amount` field becomes the SIP amount in ₹
- The `account_id` dropdown remains (it is the source bank account)

The existing frequency/date fields are unchanged.

---

### Test

**`recurringTransactionService.test.ts` — new SIP cases:**

- [ ] `processRecurringTransactions` with a portfolio SIP due today: creates `portfolio_transaction` with `type = SIP` and correct quantity (`amount / current_price`)
- [ ] Both the `portfolio_transaction` AND the bank account `withdraw` are created (linked account scenario)
- [ ] If `current_price = null`: SIP is skipped, error is logged, other due transactions still process
- [ ] If `portfolioAssetId` is null: existing behaviour unchanged (normal recurring transaction)
- [ ] SIP is NOT double-processed if profile is opened twice on the same day (recurring `next_due_date` is advanced)
- [ ] `recurring_transactions.portfolio_asset_id` is persisted and retrieved correctly

**Manual smoke test:**
- [ ] Create a recurring transaction for ₹5,000/month for Parag Parikh fund, linked to HDFC Savings
- [ ] Manually set `next_due_date` to today in the DB
- [ ] Reopen profile → `portfolio_transactions` gets a new SIP row; HDFC Savings is debited ₹5,000
- [ ] Portfolio page shows updated units for the fund

---

### Verify (Definition of Done)

- [ ] All new recurring service tests pass; existing recurring tests still pass
- [ ] `tsc --noEmit` clean
- [ ] Migration 11 runs cleanly after migrations 1–10 on a fresh DB
- [ ] End-to-end SIP flow works: set up → profile reopen → transaction created → account debited
- [ ] Existing non-portfolio recurring transactions are unaffected

---

## Phase Summary

| Phase | Delivers | End state |
|-------|----------|-----------|
| 1 | Schema, types, repositories | Tested data layer; nothing visible in UI |
| 2 | Services, IPC, basic UI | Can add funds, log buy/sell manually |
| 3 | Price providers, auto-refresh | Live NAVs, price history, staleness indicators |
| 4 | Analytics, dashboard, charts | Full portfolio view with XIRR, P&L, pie chart |
| 5 | SIP auto-processing | Monthly SIPs process automatically on profile open |

Each phase is a vertical slice: the backend and UI for that slice are delivered together, tested together, and usable before the next phase begins.
