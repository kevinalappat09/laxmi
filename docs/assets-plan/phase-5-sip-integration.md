# Phase 5 — SIP Integration

**Goal:** User can set up a monthly SIP for a mutual fund from the recurring transactions screen. When the app is opened on or after a SIP's due date, the system automatically logs the portfolio transaction at the correct due-date NAV and optionally debits a source bank account — with zero manual effort.

**Depends on:**
- Phase 0 — `recurring_transactions.account_id` must be nullable (direct SIPs with no source account)
- Phase 3 — `MfapiProviderImpl.getNavForDate()` must exist for historical NAV lookup
- Portfolio assets must exist in DB

**Does not break:** All existing non-portfolio recurring transactions continue working exactly as before.

---

## SIP date and NAV semantics

A SIP fires on its scheduled date (e.g. the 30th of every month). Even if the app is opened 3 days late (on the 2nd), the SIP must:
1. Use the **NAV of the 30th** as the price per unit — not today's price
2. Log the `transaction_date` as the **30th** — not today
3. Derive `quantity = SIP amount / NAV on the 30th`

This matches real Indian SIP behaviour exactly.

**Holiday handling:** If the 30th is a market holiday (no NAV declared by AMFI), MFAPI will have no data for that date. In that case, the SIP uses the **next available business day's NAV** — which is how AMFI mandates holiday SIP allotment.

**NAV lookup order:**
1. Check `portfolio_price_history` for `assetId` on the due date → if found, use it (app was open that day)
2. If not found → call `mfapiProvider.getNavForDate(schemeCode, dueDateISO)` → fetches MFAPI full history and finds due date or next business day
3. Store the found NAV in `portfolio_price_history` for future reference (idempotent upsert)
4. If MFAPI fails (network error) → skip this SIP silently (see Error Handling section)

---

## What gets delivered

| Deliverable | Location |
|-------------|----------|
| Migration 13 — portfolio SIP columns on `recurring_transactions` | `src/migrations/13-extend_recurring_portfolio_sip.ts` |
| Updated `RecurringTransaction` types | `src/types/recurringTransaction.ts` |
| Updated `RecurringTransactionRepository` | `src/repository/recurringTransaction/recurringTransactionRepository.ts` |
| Extended `RecurringTransactionServiceImpl` | `src/services/recurringTransaction/recurringTransactionService.ts` |
| `RecurringDialog` — portfolio fund toggle | `renderer/src/pages/recurring/RecurringDialog.tsx` |
| New recurring service test cases | `src/services/recurringTransaction/recurringTransactionService.test.ts` |

---

## Step 1 — Migration 13

**`src/migrations/13-extend_recurring_portfolio_sip.ts`**

```ts
import { SQLiteDatabase } from '../database/databaseService'

export function up(db: SQLiteDatabase): void {
    db.exec(`
        ALTER TABLE recurring_transactions
        ADD COLUMN portfolio_asset_id INTEGER REFERENCES portfolio_assets(id);

        ALTER TABLE recurring_transactions
        ADD COLUMN asset_account_id INTEGER REFERENCES accounts(account_id);
    `)
}
```

**Column purposes:**
- `portfolio_asset_id` — the mutual fund this SIP invests in; when set, the recurring transaction is a portfolio SIP rather than a plain income/expense
- `asset_account_id` — the investment account (e.g. Zerodha in Laxmi) where units are held; mandatory when `portfolio_asset_id` is set
- The existing `account_id` (now nullable since Phase 0) serves as the **source account** (bank to debit); optional for SIPs

**Migration ordering note:** This migration must run after migration 9 (`portfolio_assets` table). Guaranteed by numeric ordering.

---

## Step 2 — Update `RecurringTransaction` Type

**`src/types/recurringTransaction.ts`** — update existing interface and add new fields:

```ts
export interface RecurringTransaction {
    recurring_id?: number
    account_id: number | null          // nullable since Phase 0; source account for SIPs (optional)
    transaction_type: TransactionType.Withdraw | TransactionType.Deposit
    amount: number
    category_id?: number
    classification: Classification | null  // nullable since Phase 0; not required for SIPs
    payee?: string
    note?: string
    frequency: RecurringFrequency
    day_of_week?: number
    day_of_month?: number
    month_of_year?: number
    start_date: Date
    last_processed_date?: Date
    is_active: boolean
    created_on: Date
    modified_on: Date
    /** When set, this recurring transaction is a portfolio SIP. */
    portfolio_asset_id?: number | null
    /** Required when portfolio_asset_id is set — the investment account (Zerodha, Groww). */
    asset_account_id?: number | null
}

export interface CreateRecurringTransactionRequest {
    account_id?: number | null         // optional for portfolio SIPs
    transaction_type: TransactionType.Withdraw | TransactionType.Deposit
    amount: number
    category_id?: number
    classification?: Classification | null  // optional for portfolio SIPs
    payee?: string
    note?: string
    frequency: RecurringFrequency
    day_of_week?: number
    day_of_month?: number
    month_of_year?: number
    start_date: Date
    portfolio_asset_id?: number | null
    asset_account_id?: number | null
}
```

---

## Step 3 — Update `RecurringTransactionRepository`

In `src/repository/recurringTransaction/recurringTransactionRepository.ts`:

- **SELECT**: add `portfolio_asset_id` and `asset_account_id` to all `SELECT` statements and map in `mapRowToRecurringTransaction`
- **INSERT**: include both new columns (default `NULL`)
- **UPDATE (save method)**: include both new columns when updating

No other logic changes — the repository stays dumb.

---

## Step 4 — Extend `RecurringTransactionServiceImpl`

### Service validation update

In `validateCreateRequest`, update the account_id check:

```ts
// Before: account_id always required
// After: account_id required only for non-portfolio recurring transactions
if (!request.portfolio_asset_id && !request.account_id) {
    throw new Error("account_id is required for non-portfolio recurring transactions.")
}
if (request.portfolio_asset_id && !request.asset_account_id) {
    throw new Error("asset_account_id is required when portfolio_asset_id is set.")
}
```

### SIP processing branch in `processRecurringTransactions`

The existing method already uses `dueDate` as the transaction date — follow the same pattern for SIPs. Add a branch at the top of the due-dates loop:

```ts
for (const dueDate of dueDates) {

    if (recurring.portfolio_asset_id != null) {
        // ── Portfolio SIP branch ──────────────────────────────────────
        await this.processSipEntry(recurring, dueDate, db)

    } else {
        // ── Existing branch — unchanged ───────────────────────────────
        this.transactionService.createTransaction({
            account_id: recurring.account_id!,
            transaction_date: dueDate,            // ← due date, not today (already correct)
            transaction_type: recurring.transaction_type,
            amount: recurring.amount,
            category_id: recurring.category_id,
            classification: recurring.classification!,
            payee: recurring.payee,
            note: recurring.note,
        })
    }

    repository.updateLastProcessedDate(recurring.recurring_id!, dueDate)
    createdCount++
}
```

**Important:** `updateLastProcessedDate` is called with `dueDate`, not today — this is already how the existing non-SIP path works. If `processSipEntry` throws (network error), the calling code catches it, does NOT call `updateLastProcessedDate`, and moves on to the next recurring transaction. The SIP will retry on the next app open.

### `processSipEntry` implementation

```ts
private async processSipEntry(
    recurring: RecurringTransaction,
    dueDate: Date,
    db: SQLiteDatabase
): Promise<void> {
    const dueDateISO = dueDate.toISOString().split('T')[0]

    const assetRepo = new PortfolioAssetRepositoryImpl(db)
    const asset     = assetRepo.getById(recurring.portfolio_asset_id!)

    if (!asset || !asset.isActive) {
        throw new Error(`Portfolio asset ${recurring.portfolio_asset_id} not found or inactive`)
    }
    if (!asset.priceSourceId) {
        throw new Error(`Asset ${asset.name} has no price source configured`)
    }

    // 1. Look up due-date NAV: check history first, then MFAPI
    const priceRepo = new PortfolioPriceRepositoryImpl(db)
    let navForDate  = priceRepo.getNavForDate(asset.id, dueDateISO)

    if (navForDate == null) {
        const provider = new MfapiProviderImpl()
        navForDate = await provider.getNavForDate(asset.priceSourceId, dueDateISO)
        if (navForDate == null) {
            throw new Error(`Could not find NAV for ${asset.name} on or after ${dueDateISO}`)
        }
        // Store in history for future reference
        priceRepo.upsertDailyPrice(asset.id, navForDate, asset.currency, dueDateISO)
    }

    const quantity = recurring.amount / navForDate

    // 2. Write portfolio transaction + optional bank debit atomically
    db.transaction(() => {
        const portfolioTxnRepo = new PortfolioTransactionRepositoryImpl(db)
        portfolioTxnRepo.create({
            portfolioAssetId:    asset.id,
            transactionType:     'SIP',
            quantity,
            pricePerUnit:        navForDate!,
            fees:                0,
            taxes:               0,
            currency:            asset.currency,
            transactionDate:     dueDate,           // ← use due date, not today
            isDividendReinvestment: false,
            assetAccountId:      recurring.asset_account_id!,
            sourceAccountId:     recurring.account_id ?? null,
            linkedRecurringId:   recurring.recurring_id!,
        })

        // Only debit source account if one is configured
        if (recurring.account_id != null) {
            this.transactionService.createTransaction({
                account_id:       recurring.account_id,
                transaction_date: dueDate,          // ← use due date, not today
                transaction_type: TransactionType.Withdraw,
                amount:           recurring.amount,
                classification:   Classification.Needs,  // investment debits are classified as 'needs'
                payee:            asset.name,
                note:             `SIP — ${asset.name}`,
            })
        }
    })()
}
```

### Error handling for SIPs

`processRecurringTransactions` catches errors per recurring transaction:

```ts
for (const recurring of recurringTransactions) {
    // ...compute dueDates...

    for (const dueDate of dueDates) {
        try {
            if (recurring.portfolio_asset_id != null) {
                await this.processSipEntry(recurring, dueDate, db)
            } else {
                this.transactionService.createTransaction({ ... })
            }

            repository.updateLastProcessedDate(recurring.recurring_id!, dueDate)
            createdCount++

        } catch (err) {
            // Silent failure: log to console, do NOT advance last_processed_date.
            // The SIP will retry automatically the next time the app is opened.
            // If the same SIP keeps failing for 3+ consecutive due dates,
            // surface a quiet notification (future improvement).
            console.warn(`SIP processing failed for recurring ${recurring.recurring_id} on ${dueDate.toISOString()}:`, err)
            sipErrors.push({
                recurringId: recurring.recurring_id!,
                dueDate,
                error: err instanceof Error ? err.message : String(err),
            })
        }
    }
}
```

**Failure cases and outcomes:**

| Error | What happens |
|-------|-------------|
| MFAPI network failure | `last_processed_date` not advanced; retries next app open |
| NAV genuinely unavailable (fund wound up, etc.) | Same — retries; will keep failing until user deactivates the SIP |
| Asset deactivated | Same — retries silently; user should deactivate the SIP too |
| Asset account deactivated | Same — retries silently |
| DB write failure (disk full, etc.) | Same — transaction rolled back, retries next open |

All errors are silent from the user's perspective. No notification is shown in v1. A future improvement would be: if a SIP has failed for N consecutive expected due dates (computable from `last_processed_date` + frequency vs today), surface a quiet badge on the recurring transactions page.

---

## Step 5 — `RecurringDialog` UI Update

The existing `RecurringDialog` creates/edits recurring transactions. Add an optional "Portfolio SIP" section.

### New UI section (below existing fields)

```
┌──────────────────────────────────────────────────┐
│  ...existing fields (type, amount, frequency)... │
├──────────────────────────────────────────────────┤
│  Portfolio SIP (optional)                        │
│                                                  │
│  [ ] This is a mutual fund SIP                   │
│                                                  │
│  [when checked:]                                 │
│  Fund:               [ Select fund ▼ ]           │
│                       Parag Parikh Flexi Cap     │
│                       HDFC Top 100 Fund          │
│                                                  │
│  Investment account: [ Zerodha ▼ ]  ← required  │
│  Source account:     [ None ▼ ]     ← optional   │
│                                                  │
│  ℹ  On each due date, ₹{amount} will be          │
│     invested at the NAV of that date.            │
│     {account} will be debited if selected.       │
└──────────────────────────────────────────────────┘
```

**When the "Portfolio SIP" checkbox is checked:**
- Fund dropdown: lists all active portfolio assets; calls `window.financeAPI.portfolio.asset.list()`
- Investment account: lists only `sub_type = 'investment'` accounts (mandatory)
- Source account: lists all active accounts with a "None" default (optional)
- The existing "Type" field (withdraw/deposit) is hidden — SIPs always generate a withdraw on the source account
- `classification` field is hidden — not needed for SIPs

**On submit:**

```ts
const request: CreateRecurringTransactionRequest = {
    account_id:         isPortfolioSip ? (sourceAccountId ?? null) : accountId,
    transaction_type:   TransactionType.Withdraw,
    amount,
    classification:     isPortfolioSip ? null : classification,
    frequency,
    day_of_month,
    start_date,
    portfolio_asset_id: isPortfolioSip ? portfolioAssetId : null,
    asset_account_id:   isPortfolioSip ? assetAccountId : null,
}
```

---

## Tests

### New test cases in `recurringTransactionService.test.ts`

Set up: open in-memory DB, run all migrations 1–13, create a portfolio asset, create accounts.

- [ ] Portfolio SIP due today: creates a `portfolio_transactions` row with `transaction_type = 'SIP'`, correct `quantity = amount / navForDate`, `transaction_date = dueDate` (NOT today)
- [ ] Portfolio SIP due today: creates a Laxmi `transactions` row (withdraw) on the source account when `account_id` is set
- [ ] Portfolio SIP due today with `account_id = null`: creates portfolio transaction; NO Laxmi bank transaction
- [ ] Portfolio SIP: `last_processed_date` is advanced to `dueDate` after successful processing
- [ ] Portfolio SIP: uses due-date NAV from `portfolio_price_history` when available (MFAPI not called)
- [ ] Portfolio SIP: calls MFAPI `getNavForDate` when no price history exists for due date
- [ ] Portfolio SIP: stores fetched NAV in `portfolio_price_history` after successful MFAPI lookup
- [ ] Portfolio SIP: atomicity — if bank withdraw fails, portfolio transaction is also rolled back
- [ ] Portfolio SIP: MFAPI network failure → SIP skipped, `last_processed_date` NOT advanced, error logged
- [ ] Portfolio SIP opened 3 days late: `dueDate` is the original scheduled date (30th), not today (2nd)
- [ ] Portfolio SIP: `asset_account_id` is set correctly on the created portfolio transaction
- [ ] `validateCreateRequest`: throws when `portfolio_asset_id` set but `asset_account_id` missing
- [ ] `validateCreateRequest`: allows `account_id = null` when `portfolio_asset_id` is set
- [ ] Regular recurring transaction (no `portfolio_asset_id`): behaviour completely unchanged

### Existing tests must still pass

Run the full `recurringTransactionService.test.ts` suite. No existing test case should fail. The new SIP branch is only triggered when `portfolio_asset_id IS NOT NULL`.

### Manual smoke test

1. Create investment account "Zerodha" and savings account "HDFC Savings" (Phase 2)
2. Add PPFAS Flexi Cap to portfolio (Phase 2)
3. Refresh prices so `current_price` is set (Phase 3)
4. Open `RecurringDialog` → check "Portfolio SIP" → select PPFAS → investment account = Zerodha → source account = HDFC Savings → amount ₹5000, frequency monthly, day 30, start date → save
5. Verify `recurring_transactions` row has `portfolio_asset_id` and `asset_account_id` set
6. Manually set `last_processed_date` to null (or a past date before the 30th) in the DB
7. Close and reopen profile
8. Verify:
   - A `portfolio_transactions` row exists: `transaction_type = 'SIP'`, `transaction_date = the 30th`, correct `quantity`, `asset_account_id = Zerodha`
   - A Laxmi `transactions` row exists: `withdraw`, `amount = 5000`, `account_id = HDFC Savings`, `transaction_date = the 30th`
   - `recurring_transactions.last_processed_date = the 30th` (not today)
   - Portfolio page shows updated units for PPFAS Flexi Cap
9. Reopen profile → SIP is NOT processed again (last_processed_date advanced)
10. Test direct SIP (no source account): same flow but Source account = None → only portfolio transaction created, no bank debit
11. Simulate network failure: mock MFAPI to throw → SIP silently skipped, `last_processed_date` not advanced → on next open, SIP fires again

---

## Verify — Definition of Done

- [ ] `npm test` — all new SIP test cases pass
- [ ] `npm test` — all existing recurring transaction tests still pass (zero regressions)
- [ ] `tsc --noEmit` — no TypeScript errors
- [ ] Migration 13 runs cleanly after migrations 1–12 on a fresh profile
- [ ] End-to-end SIP: create → trigger → portfolio transaction at correct due-date NAV → bank debited at correct due date
- [ ] Direct SIP (no source account): only portfolio transaction created
- [ ] SIP opened 3 days late: `transaction_date` is the due date, not app-open date
- [ ] Network failure during SIP: `last_processed_date` not advanced; SIP retries next open
- [ ] Existing non-portfolio recurring transactions are completely unaffected
