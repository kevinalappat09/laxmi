# Phase 4 — Analytics Dashboard

**Goal:** Full portfolio dashboard across three sections — summary header, allocation charts, and a sub-category-tabbed fund list. Plus per-fund detail page with NAV history.

**Depends on:** Phase 3 complete — analytics requires `current_price` to be non-null and `portfolio_price_history` to have at least one record for day gain/loss to work.

**Unlocks:** Nothing — this is the last purely additive phase before Phase 5 (SIP).

---

## What gets delivered

| Deliverable | Location |
|-------------|----------|
| `xirr@1.1.0` pinned in `package.json` | root `package.json` |
| Analytics service | `src/services/portfolioAnalytics/portfolioAnalyticsService.ts` |
| IPC handlers (summary, asset, nav-history) | `main.ts` |
| preload analytics namespace | `preload.ts`, `renderer/src/types/global.d.ts` |
| Portfolio dashboard (summary bar + pie chart + fund table) | `renderer/src/pages/portfolio/PortfolioPage.tsx` |
| Asset detail page (NAV chart + transactions + per-fund metrics) | `renderer/src/pages/portfolio/AssetDetailPage.tsx` + `.css` |
| Analytics service tests | `src/services/portfolioAnalytics/portfolioAnalyticsService.test.ts` |

---

## Step 1 — Pin `xirr` Dependency

**`package.json`** (root):

```json
"xirr": "1.1.0"
```

Run `npm install`. Verify `package-lock.json` shows `xirr@1.1.0` with an integrity hash.

**Why `1.1.0` is safe to pin:** Last published November 2020. Five total versions, one dependency. No new versions since 2020 is a supply chain positive for a math utility — the surface is frozen and auditable.

---

## Step 2 — `PortfolioAnalyticsService`

**`src/services/portfolioAnalytics/portfolioAnalyticsService.ts`**

### Interface

```ts
export interface PortfolioAnalyticsService {
    getPortfolioSummary(): PortfolioSummaryAnalytics
    getAssetAnalytics(assetId: number): AssetAnalytics
    getNavHistory(assetId: number, fromDate: string, toDate: string): { date: string; nav: number }[]
}
```

All methods are synchronous — `better-sqlite3` is synchronous and no network is needed for analytics.

### XIRR helper

```ts
import xirr from 'xirr'
import type { XirrCashFlow } from '../../types/portfolioAnalytics'

// XirrCashFlow uses `when: Date` to match the xirr package's expected shape exactly.
function safeXirr(flows: XirrCashFlow[]): number | null {
    if (flows.length < 2) return null
    try {
        const result = xirr(flows)
        return isFinite(result) ? result : null
    } catch {
        return null  // solver failed to converge — not an error condition
    }
}
```

### Cash flow mapping helper

A single shared function used by both `buildAssetFlows` and `buildPortfolioFlows`. Extracting it here prevents the placeholder-comment problem and ensures both callers are always in sync.

```ts
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
    return null  // DIVIDEND reinvestment: affects units but not cash flows for XIRR
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
```

### `getPortfolioSummary()` logic

```
1. db = profileSessionService.getDatabaseConnection()
2. summaryRows = portfolioTransactionRepository.getSummary()
3. allTransactions = portfolioTransactionRepository.listAll()
4. today = new Date(); todayISO = today.toISOString().split('T')[0]

5. For each summaryRow → build AssetAnalytics:
   a. currentNav    = summaryRow.currentPrice ?? 0
   b. currentValue  = summaryRow.currentValue ?? 0
   c. avco          = summaryRow.avco
   d. costBasis     = summaryRow.costBasis       (avco × remaining units)
   e. totalInvested = summaryRow.totalAcquisitionCost  (all-time spend, stays high after partial sells)
   f. unrealizedPl  = summaryRow.unrealizedPl ?? 0
   g. unrealizedPlPct = costBasis > 0 ? (unrealizedPl / costBasis) * 100 : 0
   h. realizedPl    = summaryRow.realizedPl
   i. totalPl       = unrealizedPl + realizedPl

   j. Day gain/loss:
      yesterdayNav = priceRepository.getLatestBefore(assetId, todayISO)
      if yesterdayNav != null:
        dayGainLoss    = totalUnits * (currentNav - yesterdayNav)
        dayGainLossPct = ((currentNav - yesterdayNav) / yesterdayNav) * 100
      else:
        dayGainLoss = dayGainLossPct = null

   k. firstInvestmentDate:
      filter allTransactions by portfolioAssetId, find min(transactionDate) of BUY/SIP rows

   l. CAGR:
      years = daysBetween(firstInvestmentDate, today) / 365.25
      if years >= 1 and costBasis > 0:
        cagr = (currentValue / costBasis) ** (1 / years) - 1
      else:
        cagr = null   (too young for annualised figure to be meaningful)

   m. Per-asset XIRR:
      assetFlows = buildAssetFlows(assetId, allTransactions, currentValue)
      xirr = safeXirr(assetFlows)

   n. allocationPct = 0  (filled in step 6)

6. totalCurrentValue = sum of all asset currentValues
   For each asset: allocationPct = (currentValue / totalCurrentValue) * 100

7. Portfolio-wide XIRR:
   allFlows = buildPortfolioFlows(allTransactions, totalCurrentValue)
   portfolioXirr = safeXirr(allFlows)

8. Portfolio day gain/loss:
   totalDayGainLoss = sum of non-null per-asset dayGainLoss values
   totalYesterdayValue = sum of (asset.totalUnits * yesterdayNav) for assets that have a yesterdayNav
   dayGainLossPct = totalYesterdayValue > 0 ? (totalDayGainLoss / totalYesterdayValue) * 100 : null

9. Build AllocationBreakdown (byAsset, byType, byCategory, bySubCategory)
   bySubCategory: group assets by subCategory (skip null), sum currentValue, compute pct

10. Monthly investments (last 12 months):
    SELECT strftime('%Y-%m', transaction_date) AS month, SUM(quantity * price_per_unit) AS amount
    FROM portfolio_transactions
    WHERE transaction_type IN ('BUY', 'SIP')
      AND transaction_date >= date('now', '-12 months')
    GROUP BY month
    ORDER BY month ASC
    -- fill months with 0 for any month with no transactions (done in service layer)

11. Portfolio value history (for the "value over time" chart):
    -- "Invested so far" line: running cumulative sum of (quantity * price_per_unit) for BUY/SIP,
    --   ordered by transaction_date. One point per transaction date.
    -- "Current value" line: for each calendar date that has at least one price history record,
    --   sum across all assets of (units_held_as_of_date × price_on_that_date).
    --   units_held_as_of_date = SUM(signed_quantity) FROM portfolio_transactions WHERE transaction_date <= date
    --   (signed: BUY/SIP positive, SELL/REDEMPTION negative)
    --   price_on_that_date = portfolio_price_history WHERE portfolio_asset_id = ? AND recorded_date = date
    -- In practice: fetch all price history rows, group by date, compute for each date.
    -- Return as: { date: string; invested: number; currentValue: number }[]
    -- Performance note: for a local app with < 100 funds and a few years of history (~1000 rows),
    --   this is fast enough to compute in the service layer without caching.

12. Return PortfolioSummaryAnalytics
```

### `getAssetAnalytics(assetId)` logic

Scoped version of `getPortfolioSummary`:
1. Query `portfolio_summary` WHERE `asset_id = ?`
2. Fetch transactions for that asset only
3. Compute all the same fields as above
4. `allocationPct`: `SELECT SUM(current_value) FROM portfolio_summary` to get total, then divide

### `getNavHistory(assetId, fromDate, toDate)` logic

```ts
return priceRepository.getHistoryByAsset(assetId, fromDate, toDate)
    .map(row => ({ date: row.recordedDate, nav: row.price }))
```

---

## Step 3 — IPC Handlers

Add to `main.ts`:

```ts
const portfolioAnalyticsService = new PortfolioAnalyticsServiceImpl()

ipcMain.handle('portfolio:analytics:summary',
    () => portfolioAnalyticsService.getPortfolioSummary())

ipcMain.handle('portfolio:analytics:asset',
    (_, { assetId }) => portfolioAnalyticsService.getAssetAnalytics(assetId))

ipcMain.handle('portfolio:analytics:nav-history',
    (_, { assetId, fromDate, toDate }) =>
        portfolioAnalyticsService.getNavHistory(assetId, fromDate, toDate))

// Heavy computation — called separately so the summary header loads first
ipcMain.handle('portfolio:analytics:value-history',
    (_, { fromDate }) =>
        portfolioAnalyticsService.getPortfolioValueHistory(fromDate))
```

---

## Step 4 — `preload.ts` + `global.d.ts`

Add `analytics` namespace to the existing `portfolio` object:

```ts
analytics: {
    summary:    () => ipcRenderer.invoke('portfolio:analytics:summary'),
    asset:      (assetId: number) => ipcRenderer.invoke('portfolio:analytics:asset', { assetId }),
    navHistory: (assetId: number, fromDate: string, toDate: string) =>
        ipcRenderer.invoke('portfolio:analytics:nav-history', { assetId, fromDate, toDate }),
},
```

---

## Step 5 — Portfolio Dashboard UI

Replace the plain Phase 2 list in `PortfolioPage.tsx` with the full dashboard below.

---

### Section 1 — Summary header

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ₹1,23,456   Today +₹234 (+0.19%)   P&L +₹12,345 (+11.2%)   XIRR 14.3% │
│  Total Value   Day Gain/Loss          Total Return              Portfolio  │
└──────────────────────────────────────────────────────────────────────────┘
```

- `--` when values are null (e.g. XIRR before two transactions, day gain before second day of price history)
- Day gain/loss green (positive) / red (negative)

---

### Section 2 — Allocation charts (two side-by-side panels)

**Left panel — Equity vs Debt pie**
```
┌─────────────────────────────────┐
│  Allocation by Category         │
│                                 │
│    ┌────────┐  ● Equity  78%    │
│    │  pie   │  ● Debt    22%    │
│    └────────┘                   │
└─────────────────────────────────┘
```
Values from `AllocationBreakdown.byCategory`.

**Right panel — Monthly investment bar chart**
```
┌─────────────────────────────────┐
│  Invested per Month             │
│                                 │
│  ▮  ▮  ▮  ▮  ▮  ▮              │
│  Nov Dec Jan Feb Mar Apr        │
└─────────────────────────────────┘
```
Source: `portfolio_transactions` WHERE `transaction_type IN ('BUY','SIP')`, grouped by `strftime('%Y-%m', transaction_date)`, SUM of `quantity * price_per_unit`. Shows last 12 months.

---

### Section 2b — Portfolio value over time (full-width)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Portfolio Value                                                      │
│                                                                       │
│  ₹1.2L ╮                                                    ─── 
│         ╮                                           ────────          │
│  ₹80K   ╮                             ─────────────  ← Current Value │
│         ╰──────────────────────────                                   │
│  ₹40K    ─────────────────────────────────────────  ← Invested       │
│                                                                       │
│         Jan      Apr      Jul      Oct      Jan                      │
└──────────────────────────────────────────────────────────────────────┘
```

- **Invested line** (flat staircase): cumulative spend, steps up on each BUY/SIP transaction
- **Current value line** (smooth curve): daily portfolio value from `portfolio_price_history` — one point per date that has price records for at least one asset
- The gap between the two lines is your unrealized P&L at a glance
- Date range selector: `[ 1M ] [ 3M ] [ 6M ] [ 1Y ] [ All ]` — filters both lines
- Empty state: "Start tracking your portfolio by adding a fund and its first transaction"
- Source data: `portfolioValueHistory` from `PortfolioSummaryAnalytics`

---

### Section 3 — Fund list with sub-category tabs

```
┌──────────────────────────────────────────────────────────────────────┐
│  All │ Large Cap │ Mid Cap │ Small Cap │ Flexi Cap │ Index │ ELSS │ … │
├──────────────────────────────────────────────────────────────────────┤
│  Fund               Invested    Current     P&L          XIRR   Day  │
│  ──────────────────────────────────────────────────────────────────  │
│  PPFAS Flexi Cap    ₹50,000     ₹56,789     +₹6,789      14.2%  +0.2%│
│  UTI Flexi Cap      ₹20,000     ₹21,100     +₹1,100       8.4%  +0.1%│
│  ──────────────────────────────────────────────────────────────────  │
│  Subtotal           ₹70,000     ₹77,889     +₹7,889      12.3%       │
└──────────────────────────────────────────────────────────────────────┘
```

- **"All" tab** shows every fund regardless of sub-category
- Each other tab filters by `asset.subCategory`; tabs with zero funds are hidden
- **Subtotal row** at the bottom of each tab showing summed invested, current value, P&L, and blended XIRR for that sub-category
- Funds without a `subCategory` set appear only in "All" (not in any sub-tab)
- Clicking a fund row navigates to `AssetDetailPage`
- `[↻ Refresh]` and `[+ Add Fund]` buttons remain in the page header

**Sub-category tab order:** All → Large Cap → Mid Cap → Small Cap → Flexi Cap → Index → ELSS → Liquid → Debt → Hybrid → International

---


---

## Step 6 — Asset Detail Page

New page: `renderer/src/pages/portfolio/AssetDetailPage.tsx`

Add `'portfolio-asset-detail'` to the `Page` union and pass `selectedAssetId` as navigation context (same pattern as `account-detail`).

### Layout

```
┌──────────────────────────────────────────────────┐
│  ← Portfolio    Parag Parikh Flexi Cap           │
├──────────────────────────────────────────────────┤
│  NAV: ₹78.45   Day: +₹0.32 (+0.41%)             │
│  Invested: ₹50,000   Current: ₹56,789            │
│  AVCO: ₹62.40/unit   Units: 123.45               │
│  Unrealized P&L: +₹6,789 (+13.6%)               │
│  XIRR: 14.2%   CAGR: 12.8%                      │
├──────────────────────────────────────────────────┤
│  NAV History  [ 1M ] [ 3M ] [ 1Y ] [ All ]       │
│  [line chart — ECharts]                          │
├──────────────────────────────────────────────────┤
│  Transactions                      [+ Buy] [+ Sell]│
│  28 May 2026  BUY   ₹5,000   123.45 units        │
│  01 Apr 2026  SIP   ₹5,000   118.22 units        │
└──────────────────────────────────────────────────┘
```

**NAV history chart date ranges:**

| Toggle | `fromDate` |
|--------|-----------|
| 1M | 30 days ago |
| 3M | 90 days ago |
| 1Y | 365 days ago |
| All | `1970-01-01` (returns all available history) |

---

## Tests

**`portfolioAnalyticsService.test.ts`** — use in-memory SQLite, run migrations 1–11 (portfolio tables; accounts metadata and SIP columns not needed for analytics), seed transactions and prices manually.

### AVCO and P&L correctness

- [ ] Single fund, one BUY of 100 units at ₹50, `current_price = 60` → `currentValue = 6000`, `costBasis = 5000`, `unrealizedPl = 1000`, `unrealizedPlPct = 20`
- [ ] Two BUYs: 100 units at ₹50 + 100 units at ₹60 → `avco = 55`, `costBasis = 11000`, total units = 200
- [ ] BUY 100 at ₹50, SELL 50 at ₹70 → `realizedPl = 50 * (70 - 50) = 1000`, remaining units = 50, `costBasis = 2500`
- [ ] Unrealized P&L is negative when `current_price < avco`
- [ ] `totalInvested` remains ₹5000 after selling 50 of 100 units; `costBasis` drops to ₹2500 (they are different fields)

### Day gain/loss

- [ ] No price history → `dayGainLoss = null`, `dayGainLossPct = null`
- [ ] Yesterday nav = 50, today nav = 51, 100 units → `dayGainLoss = 100`, `dayGainLossPct ≈ 2`
- [ ] Portfolio day gain/loss = sum across all assets (only counting assets with yesterday price)

### XIRR

- [ ] Single BUY today, terminal value = cost → `xirr ≈ 0` (or null due to same-day flows)
- [ ] `safeXirr` with < 2 flows → `null`
- [ ] `safeXirr` with solver-diverging flows → `null` (does not throw)
- [ ] Positive return scenario: BUY 1 year ago at ₹50, current value ₹60 → `xirr > 0`
- [ ] DIVIDEND cash flow is included in XIRR as a positive inflow
- [ ] DIVIDEND reinvestment is excluded from XIRR flows (units added but no cash)

### CAGR

- [ ] Holding period < 1 year → `cagr = null`
- [ ] Holding period = exactly 2 years, `costBasis = ₹1000`, `currentValue = ₹1210` → `cagr ≈ 0.10` (10%)

### Allocation

- [ ] Two funds: fund A = ₹60000, fund B = ₹40000 → fund A = 60%, fund B = 40%
- [ ] `byType` values sum to 100%
- [ ] `byCategory` values sum to 100%

### Nav history

- [ ] Returns records in ascending date order
- [ ] Correctly filters to the requested `fromDate`–`toDate` range
- [ ] Returns empty array when no history exists for the asset

### Manual smoke tests

- [ ] Dashboard loads after Phase 3 is complete (prices exist) — summary bar shows non-zero values
- [ ] Pie chart renders with correct proportions; toggling By Fund / By Type / By Category updates the chart
- [ ] Day gain/loss is `--` on first day; shows a value after a second day of price history (simulate by inserting a `portfolio_price_history` row for yesterday in the DB)
- [ ] XIRR shows `--` for a brand-new fund with one transaction
- [ ] Clicking a fund row navigates to `AssetDetailPage`
- [ ] NAV chart renders correctly on the detail page; period toggle changes the x-axis range
- [ ] Transactions list on detail page shows all transactions in reverse-date order
- [ ] `Invested` and `Current Value` are clearly different numbers for a fund that has had partial sells

---

## Verify — Definition of Done

- [ ] `npm test` — all analytics service tests pass
- [ ] `tsc --noEmit` — no TypeScript errors
- [ ] `package-lock.json` shows `xirr@1.1.0` with integrity hash
- [ ] Dashboard loads in under 1 second for a portfolio with up to 20 funds
- [ ] Summary bar totals match the sum of individual fund values (verified manually)
- [ ] Pie chart proportions are correct
- [ ] XIRR and CAGR show `--` gracefully when insufficient data (no crash, no NaN)
- [ ] Clicking a fund row navigates to the detail page
- [ ] NAV history chart renders for a fund with at least 2 days of history
- [ ] All `--` placeholders in Phase 2 are replaced with real values
