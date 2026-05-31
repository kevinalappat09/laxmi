# Phase 2 — Asset & Transaction CRUD + Basic UI

**Goal:** User can search for a mutual fund by name, add it to their portfolio, log a BUY transaction (with a ₹ amount or unit count), and see the fund in a list. The investment account (e.g. Zerodha) is always required. The source account (where money came from) is optional — supporting ESOPs, employer contributions, and assets already owned.

**Depends on:** Phase 1 complete (repositories and migrations 9–11 must exist).

**Unlocks:** Phase 3 (price providers need assets to exist), Phase 5 (SIP UI needs the portfolio asset list).

**Do not build:** Price refresh, analytics, charts.

**v1 scope:** Mutual funds only (EQUITY_MUTUAL_FUND, LIQUID_FUND). Stock and ETF flows are excluded from v1 UI but the types and validation rules are in place for when they are added.

---

## What gets delivered

| Deliverable | Location |
|-------------|----------|
| Migration 12 — `metadata` on `accounts` | `src/migrations/12-add_metadata_to_accounts.ts` |
| Account type updates | `src/types/account.ts` |
| AccountRepository update | `src/repository/account/accountRepository.ts` |
| AccountDialog redesign (type selector strip) | `renderer/src/pages/accounts/AccountDialog.tsx` |
| Portfolio asset service | `src/services/portfolio/portfolioAssetService.ts` |
| Portfolio transaction service | `src/services/portfolio/portfolioTransactionService.ts` |
| MFAPI search service | `src/services/portfolio/mfapiSearchService.ts` |
| IPC handlers (assets, transactions, search) | `main.ts` |
| preload + global type declaration | `preload.ts`, `renderer/src/types/global.d.ts` |
| Navigation registration | `renderer/src/types/navigation.ts`, `Sidebar.tsx`, `App.tsx` |
| Portfolio page (basic list) | `renderer/src/pages/portfolio/PortfolioPage.tsx` + `.css` |
| Asset dialog (MF search + confirm) | `renderer/src/pages/portfolio/AssetDialog.tsx` + `.css` |
| Transaction dialog (buy/sell) | `renderer/src/pages/portfolio/TransactionDialog.tsx` + `.css` |
| Service tests | alongside each service file |

---

## Step 0 — Migration 12 + AccountDialog redesign

### Migration 12 — `metadata` on `accounts`

**`src/migrations/12-add_metadata_to_accounts.ts`**

```ts
import { SQLiteDatabase } from '../database/databaseService'

export function up(db: SQLiteDatabase): void {
    db.exec(`ALTER TABLE accounts ADD COLUMN metadata TEXT;`)
}
```

Backward-compatible `ALTER TABLE ADD COLUMN`. All existing rows get `metadata = NULL`. No existing query or test breaks.

### Update `src/types/account.ts`

Add `metadata` to all three interfaces:

```ts
export interface Account {
    // ...all existing fields unchanged...
    metadata: Record<string, unknown> | null
}

export interface CreateAccountRequest {
    // ...all existing fields unchanged...
    metadata?: Record<string, unknown>
}

export interface UpdateAccountRequest {
    // ...all existing fields unchanged...
    metadata?: Record<string, unknown>
}
```

**Metadata shape for `sub_type = 'investment'`:**

```json
{ "brokerage": "Zerodha" }
```

Just the broker name for v1. Non-investment accounts leave `metadata = null`. The column is forward-extensible (broker API keys, account numbers, folio IDs) without another migration.

### Update `accountRepository`

- **SELECT**: `JSON.parse(row.metadata)` if not null, else return `null`
- **INSERT / UPDATE**: `JSON.stringify(metadata)` if provided, else `null`

No other changes to existing account query logic.

### AccountDialog redesign

The current dialog has a broken `<Select>` that only renders "Checking". Replace it with a **type selector strip** at the top of the dialog.

**New layout:**

```
┌──────────────────────────────────────────────┐
│  Add Account                                 │
├──────────────────────────────────────────────┤
│  [ Checking ] [ Savings ] [ Credit ] [ Investment ]  │
│                                              │
│  [fields based on selected type]             │
│                                              │
│                    [Cancel]  [Add Account]   │
└──────────────────────────────────────────────┘
```

The strip is a row of styled radio-button-style buttons. `Salary` is hidden from the UI (the enum value is kept for legacy data but users don't create salary accounts manually).

**Fields per type:**

| Tab | Fields |
|-----|--------|
| Checking | Bank name, Account name, Color, Opened on |
| Savings | Bank name, Account name, Color, Opened on |
| Credit | Bank name, Card name, Color, Opened on |
| Investment | **Broker** *(uses `institution_name` field)*, Account name, Color, Opened on |

For Investment accounts, `institution_name = broker.trim()` and `metadata = { brokerage: broker.trim() }`. Both are written together on submit:

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

The `metadata.brokerage` value is used in the TransactionDialog's investment account dropdown as the label (e.g. `"Zerodha"` instead of just the account name).

---

## Step 1 — Services

### `src/services/portfolio/portfolioAssetService.ts`

Interface + `PortfolioAssetServiceImpl`.

**Interface:**

```ts
export interface PortfolioAssetService {
    create(request: CreatePortfolioAssetRequest): PortfolioAsset
    update(id: number, request: UpdatePortfolioAssetRequest): PortfolioAsset
    deactivate(id: number): void
    getById(id: number): PortfolioAsset
    listActive(): PortfolioAsset[]
}
```

**Validation rules (throw on violation):**

| Condition | Error |
|-----------|-------|
| `type = EQUITY_MUTUAL_FUND \| LIQUID_FUND` and `priceSource !== 'MFAPI'` | Invalid price source for mutual fund |
| `type = STOCK \| ETF` and `priceSource !== 'YAHOO'` | Invalid price source for stock/ETF (future) |
| `priceSource = 'MFAPI'` and `metadata.schemeCode` absent | Missing MFAPI scheme code |
| `priceSource = 'YAHOO'` and `metadata.ticker` absent or does not end in `.NS`/`.BO` | Missing or invalid Yahoo ticker (future) |
| No active DB connection | No active profile |
| `deactivate` called with unknown id | Asset not found |

**Pattern:** Obtains DB with `profileSessionService.getDatabaseConnection()`. Instantiates `new PortfolioAssetRepositoryImpl(db)` per call (matches existing service pattern).

---

### `src/services/portfolio/portfolioTransactionService.ts`

Interface + `PortfolioTransactionServiceImpl`.

**Interface:**

```ts
export interface PortfolioTransactionService {
    create(request: CreatePortfolioTransactionRequest): PortfolioTransaction
    deactivate(id: number): void
    listByAsset(portfolioAssetId: number): PortfolioTransaction[]
}
```

**`create` logic:**

```
1. Validate: asset exists and is_active = 1
2. Validate: exactly one of quantity / investedAmount is provided
   → if investedAmount provided: quantity = investedAmount / pricePerUnit
3. Validate: assetAccountId exists, is_active = 1, and sub_type = 'investment'
4. If transactionType is SELL or REDEMPTION:
   → validate: quantity <= portfolioTransactionRepository.getTotalUnitsHeld(portfolioAssetId)
   → throw if overselling ("Cannot sell more units than currently held")
5. If sourceAccountId is set:
   a. Validate: source account exists and is_active = 1
   b. Open db.transaction():
      - INSERT portfolio_transaction (with resolved quantity, assetAccountId, sourceAccountId)
      - Call transactionService.createTransaction() with classification = 'needs':
          BUY | SIP          → { withdraw, sourceAccountId, amount: qty*pricePerUnit+fees+taxes, classification: needs }
          SELL | REDEMPTION  → { deposit,  sourceAccountId, amount: qty*pricePerUnit-fees-taxes,  classification: needs }
          DIVIDEND (cash)    → { deposit,  sourceAccountId, amount: qty*pricePerUnit,             classification: needs }
          DIVIDEND (reinvest) → no Laxmi transaction
6. If sourceAccountId is null:
   - INSERT portfolio_transaction only (no Laxmi account movement)
7. Return created PortfolioTransaction
```

**Why `classification: 'needs'` for the generated bank transaction:** The bank debit (e.g. ₹5000 leaving HDFC Savings to fund a SIP) is a real outflow from your account and should appear in your budget. `needs` is the default — the user can recategorise it from the transactions list if they prefer a different classification.

**Why call `transactionService.createTransaction()` inside `db.transaction()`:** `transactionService` is already aware of the open transaction context via the same `db` connection — `better-sqlite3` transactions are connection-scoped. Both the portfolio transaction insert and the bank transaction insert are wrapped in a single `db.transaction()` call, so both commit or both roll back together.

**Why `withdraw` not `transfer`:** A `transfer` in Laxmi requires both ends to be tracked accounts. The broker/AMC is not a tracked account. The withdraw exits the Laxmi money scope into the investment world.

---

### `src/services/portfolio/mfapiSearchService.ts`

Single async method:

```ts
export interface MfapiSearchService {
    search(query: string): Promise<MfSearchResult[]>
}

export class MfapiSearchServiceImpl implements MfapiSearchService {
    async search(query: string): Promise<MfSearchResult[]> {
        const res = await fetch(
            `https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`
        )
        if (!res.ok) throw new Error(`MFAPI search failed: ${res.status}`)
        const json = await res.json() as { schemeCode: number; schemeName: string }[]
        return json.map(item => ({
            schemeCode: String(item.schemeCode),
            schemeName: item.schemeName,
        }))
    }
}
```

This is `async` — the IPC handler for it must use `ipcMain.handle` (already async-capable).

---

## Step 2 — IPC Handlers (`main.ts`)

Register all handlers under the `portfolio:` namespace. Instantiate services once at module level, same as all existing services:

```ts
const portfolioAssetService      = new PortfolioAssetServiceImpl()
const portfolioTransactionService = new PortfolioTransactionServiceImpl()
const mfapiSearchService         = new MfapiSearchServiceImpl()

// Assets
ipcMain.handle('portfolio:asset:create',     (_, req) => portfolioAssetService.create(req))
ipcMain.handle('portfolio:asset:update',     (_, { id, request }) => portfolioAssetService.update(id, request))
ipcMain.handle('portfolio:asset:deactivate', (_, { id }) => portfolioAssetService.deactivate(id))
ipcMain.handle('portfolio:asset:list',       () => portfolioAssetService.listActive())
ipcMain.handle('portfolio:asset:get',        (_, { id }) => portfolioAssetService.getById(id))

// Fund discovery
ipcMain.handle('portfolio:mfapi:search', (_, { query }) => mfapiSearchService.search(query))

// Transactions
ipcMain.handle('portfolio:transaction:create',
    (_, req) => portfolioTransactionService.create(req))
ipcMain.handle('portfolio:transaction:deactivate',
    (_, { id }) => portfolioTransactionService.deactivate(id))
ipcMain.handle('portfolio:transaction:list-by-asset',
    (_, { portfolioAssetId }) => portfolioTransactionService.listByAsset(portfolioAssetId))
```

**Date coercion note:** `transaction_date` arrives from the renderer as a serialised string. Coerce it back to `new Date(req.transactionDate)` in the handler before passing to the service, matching the existing pattern in the `create-transaction` handler.

---

## Step 3 — `preload.ts` + `global.d.ts`

Add to `contextBridge.exposeInMainWorld('financeAPI', { ... })` — add the `portfolio` namespace alongside existing keys:

```ts
portfolio: {
    asset: {
        create:     (req) => ipcRenderer.invoke('portfolio:asset:create', req),
        update:     (id, req) => ipcRenderer.invoke('portfolio:asset:update', { id, request: req }),
        deactivate: (id) => ipcRenderer.invoke('portfolio:asset:deactivate', { id }),
        list:       () => ipcRenderer.invoke('portfolio:asset:list'),
        get:        (id) => ipcRenderer.invoke('portfolio:asset:get', { id }),
    },
    mfapi: {
        search: (query) => ipcRenderer.invoke('portfolio:mfapi:search', { query }),
    },
    transaction: {
        create:      (req) => ipcRenderer.invoke('portfolio:transaction:create', req),
        deactivate:  (id) => ipcRenderer.invoke('portfolio:transaction:deactivate', { id }),
        listByAsset: (portfolioAssetId) =>
            ipcRenderer.invoke('portfolio:transaction:list-by-asset', { portfolioAssetId }),
    },
},
```

Add the full TypeScript declaration to `renderer/src/types/global.d.ts`. Import types from `../../../../src/types/portfolio*` following the existing pattern.

---

## Step 4 — Navigation

Three small changes:

**`renderer/src/types/navigation.ts`** — add `'portfolio'` to the `Page` union type.

**`renderer/src/components/layout/Sidebar.tsx`** — add a Portfolio nav item (icon + label) in the same style as existing nav items.

**`renderer/src/App.tsx`** — add a case for `'portfolio'` that renders `<PortfolioPage />`.

---

## Step 5 — UI Components

### `PortfolioPage.tsx`

The basic list view. No prices or analytics yet — those come in Phase 3 and 4. Show `—` for any field that requires a current price.

```
┌─────────────────────────────────────────────┐
│  Portfolio                      [+ Add Fund] │
├─────────────────────────────────────────────┤
│  Fund                  Units     Invested    │
│  ─────────────────────────────────────────── │
│  Parag Parikh Flexi    123.45    ₹50,000     │
│  HDFC Top 100          89.12     ₹30,000     │
├─────────────────────────────────────────────┤
│  (empty state illustration + prompt when    │
│   no assets exist)                          │
└─────────────────────────────────────────────┘
```

Each row has a `[+ Buy]` / `[+ Sell]` action that opens `TransactionDialog` with the fund pre-selected.

**Data fetching:** On mount, call `window.financeAPI.portfolio.asset.list()`. Re-fetch after `TransactionDialog` or `AssetDialog` onSaved.

---

### `AssetDialog.tsx`

Two-step dialog for adding a mutual fund. **v1: MF only** (MFAPI search). Stock/ETF entry is deferred.

**Step 1 — Fund search:**

```
┌─────────────────────────────────────┐
│  Add Fund                           │
│                                     │
│  Search: [Parag Parikh_____________]│
│                                     │
│  ● Parag Parikh Flexi Cap — Direct  │
│    Parag Parikh Conservative Hybrid │
│    ...                              │
│                                     │
│           [Cancel]  [Next →]        │
└─────────────────────────────────────┘
```

- Search field calls `portfolio:mfapi:search` as user types, debounced 400ms
- Results list — selecting one stores `{ schemeCode, schemeName }`

**Step 2 — Confirm:**

```
┌────────────────────────────────────────────┐
│  Add Fund                                  │
│                                            │
│  Name:         Parag Parikh Flexi Cap      │
│  Category:     ( EQUITY )  ( DEBT )        │
│  Sub-category: [ Flexi Cap           ▼ ]   │
│                                            │
│               [← Back]  [Add Fund]         │
└────────────────────────────────────────────┘
```

Sub-category dropdown values (in order): *(none)*, Large Cap, Mid Cap, Small Cap, Flexi Cap, Index, ELSS, Liquid, Debt, Hybrid, International. Defaults to `(none)` — optional.

On submit: calls `portfolio:asset:create` with `type = EQUITY_MUTUAL_FUND`, `priceSource = MFAPI`, `priceSourceId = schemeCode`, `subCategory = selectedSubCategory | null`, `metadata = { schemeCode, schemeName }`.

---

### `TransactionDialog.tsx`

```
┌──────────────────────────────────────────┐
│  Log Transaction — Parag Parikh Flexi    │
├──────────────────────────────────────────┤
│  Type:  [ Buy ▼ ]                        │
│  Date:  [28-05-2026_________________]   │
│                                          │
│  ── Amount ──────────────────────────── │
│  ₹ [5000_____]   ← primary input        │
│  ≈ 123.45 units at ₹40.55/unit          │
│                                          │
│  [ ] Enter units manually               │
│                                          │
│  NAV / Price: [₹40.55_______]  ← user enters manually │
│  Fees:        [0_____________]  (optional)      │
│                                          │
│  ── Accounts ────────────────────────── │
│  Investment account: [ Zerodha ▼ ]  ← required │
│  Funded from:        [ None ▼ ]     ← optional │
│              HDFC Savings            │
│              ICICI Savings           │
│                                          │
│  Note: [___________________________]    │
│                                          │
│           [Cancel]  [Log Transaction]   │
└──────────────────────────────────────────┘
```

**Price input (no live NAV):**
- The "NAV / Price" field is a plain manual input — the user types the price at which they transacted
- There is no live price pre-fill here; live prices are informational (shown in the portfolio list after Phase 3)
- Unit calculation `≈ units = ₹amount / price` is computed in real-time from the two fields the user has entered

**Amount mode (default for MFs):**
- User enters ₹ amount and the NAV
- `units = amount / nav` is computed in real-time and shown below the field
- `quantity` sent to service = computed units

**Units mode (for existing holdings, ESOPs):**
- Toggle "Enter units manually"
- Shows a units input instead; ₹ amount field is hidden
- `quantity` sent directly; `investedAmount` not sent

**Investment account dropdown (required):**
- Lists only accounts where `sub_type = 'investment'`
- Shows `metadata.brokerage` as the display label (e.g. `"Zerodha"`)
- User must select one — this is always mandatory

**"Funded from" dropdown (optional):**
- Default: `"None"` — `sourceAccountId = null`
- Lists all active Laxmi accounts (checking, savings, salary)
- When selected: the service creates a matching debit/credit on that account
- Label: "Funded from" for BUY/SIP; "Proceeds to" for SELL/REDEMPTION

**Oversell guard:**
- When type = SELL/REDEMPTION and units entered > units held, show an inline error: "You only hold X.XX units of this fund"
- The service also validates this, but the UI guard prevents the submit

---

## Tests

### `portfolioAssetService.test.ts`

- [ ] Creates `EQUITY_MUTUAL_FUND` with valid MFAPI metadata → returns `PortfolioAsset`
- [ ] Creates `LIQUID_FUND` with valid MFAPI metadata → success
- [ ] Rejects `EQUITY_MUTUAL_FUND` with `priceSource = 'YAHOO'` → throws
- [ ] Rejects MFAPI asset where `metadata.schemeCode` is absent → throws
- [ ] Throws when no active DB connection
- [ ] `deactivate` marks asset inactive; `listActive` no longer returns it
- [ ] `deactivate` throws when asset ID not found

### `portfolioTransactionService.test.ts`

- [ ] BUY with `investedAmount = 5000`, `pricePerUnit = 50` → stored `quantity = 100`
- [ ] BUY with `quantity = 10`, `pricePerUnit = 50` → stored `quantity = 10`
- [ ] Throws when both `quantity` and `investedAmount` are provided
- [ ] Throws when neither `quantity` nor `investedAmount` is provided
- [ ] BUY with `sourceAccountId`: both `portfolio_transaction` and a Laxmi `withdraw` are created
- [ ] BUY with `sourceAccountId`: if Laxmi account transaction throws, portfolio transaction is also rolled back (atomicity)
- [ ] BUY with `sourceAccountId = null`: only `portfolio_transaction` is created; no Laxmi `transaction` row
- [ ] SELL with `sourceAccountId`: creates a `deposit` (not `withdraw`) on the Laxmi account
- [ ] SELL: throws when `quantity > getTotalUnitsHeld` (oversell guard)
- [ ] SELL: succeeds when `quantity = getTotalUnitsHeld` (exact sell-all)
- [ ] DIVIDEND cash (`isDividendReinvestment = false`) with `sourceAccountId`: creates `deposit` on Laxmi account
- [ ] DIVIDEND reinvestment (`isDividendReinvestment = true`): no Laxmi transaction
- [ ] Throws when `portfolioAssetId` refers to a non-existent asset
- [ ] Throws when `portfolioAssetId` refers to an inactive asset
- [ ] Throws when `assetAccountId` refers to a non-investment account
- [ ] Throws when `sourceAccountId` refers to a non-existent Laxmi account

### Manual UI smoke tests

- [ ] AccountDialog — Checking tab shows Bank name and Account name fields
- [ ] AccountDialog — Investment tab shows "Broker" label; creating "Zerodha" → `metadata.brokerage = "Zerodha"` in DB
- [ ] PortfolioPage — empty state renders with prompt
- [ ] AssetDialog — type "Parag Parikh" → MFAPI results appear within ~1 second
- [ ] AssetDialog — select a fund → Step 2 shows name pre-filled → confirm → asset appears in PortfolioPage
- [ ] TransactionDialog — `[+ Buy]` opens with fund name in title
- [ ] TransactionDialog — enter ₹5000 and NAV ₹40.55 → unit count `≈ 123.34` updates in real-time
- [ ] TransactionDialog — submit with "None" in Funded from → only `portfolio_transaction` created; no Laxmi account touched
- [ ] TransactionDialog — submit with "HDFC Savings" in Funded from → `portfolio_transaction` + HDFC Savings balance decreases
- [ ] TransactionDialog — toggle "Enter units manually" → ₹ field hides; units field appears
- [ ] TransactionDialog — SELL more units than held → inline error shown; submit blocked

---

## Verify — Definition of Done

- [ ] `npm test` — all service tests pass (asset service, transaction service)
- [ ] `tsc --noEmit` — no TypeScript errors
- [ ] Migration 12 runs cleanly after migrations 1–11 on a fresh profile
- [ ] Account metadata persisted and retrieved correctly for investment accounts
- [ ] Existing account tests still pass (migration 12 is additive only)
- [ ] Full buy flow end-to-end: search fund → add → log BUY with funded-from account → account balance debited in Transactions page
- [ ] Direct buy flow (no funded-from account): no Laxmi transaction created
- [ ] Oversell blocked at UI and service layer
- [ ] Empty state renders correctly with no assets
- [ ] App does not crash when profile has no portfolio assets
