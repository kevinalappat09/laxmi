# Phase 0 — Recurring Transactions Architecture Fix

**Goal:** Make the `recurring_transactions` table flexible enough to support portfolio SIPs (Phase 5) without breaking any existing functionality. Existing recurring income/expense transactions are completely unaffected.

**Depends on:** Nothing. This is pure prep work.

**Unlocks:** Phase 5 — SIP processing needs `account_id` to be optional (ESOPs / direct investments have no source account).

**Do not build:** Any portfolio features. Any UI changes.

---

## Why this is needed

The `recurring_transactions` table has two hard `NOT NULL` constraints that block SIP support:

| Constraint | Why it blocks SIPs |
|------------|-------------------|
| `account_id INTEGER NOT NULL` | A SIP for an ESOP grant or employer-contributed fund has no source bank account to debit |
| `classification TEXT NOT NULL` | SIP recurring entries don't belong to a budget classification; the generated *bank* transaction (if any) will carry `needs`, but the recurring template itself shouldn't need one |

The `transactions` table is **not touched** — bank transactions created when debiting an account to fund a portfolio buy are normal Laxmi transactions and keep their `classification` (using `needs`). Only the recurring template row needs the relaxation.

SQLite does not support `ALTER COLUMN` to relax `NOT NULL`. The table must be recreated. Zero behavior change for existing rows.

---

## What gets delivered

| Deliverable | Location |
|-------------|----------|
| Migration 8 — relax constraints on `recurring_transactions` | `src/migrations/8-relax_recurring_transactions.ts` |
| No changes to `transactions` table or types | (bank transactions keep their classification requirement) |
| No changes to `transactionService` | (classification still required for all normal creates) |
| No type changes yet | (Phase 5 updates `RecurringTransaction` types when SIP is built) |

---

## Step 1 — Migration 8: Relax `recurring_transactions`

**`src/migrations/8-relax_recurring_transactions.ts`**

```ts
import { SQLiteDatabase } from '../database/databaseService'

export function up(db: SQLiteDatabase): void {
    db.exec(`PRAGMA foreign_keys = OFF`)

    db.exec(`
        CREATE TABLE recurring_transactions_new (
            recurring_id     INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id       INTEGER,                              -- was NOT NULL; now nullable for direct SIPs
            transaction_type TEXT    NOT NULL CHECK (transaction_type IN ('withdraw', 'deposit')),
            amount           REAL    NOT NULL CHECK (amount > 0),
            category_id      INTEGER,
            classification   TEXT    CHECK (                       -- was NOT NULL; now nullable for SIP transactions
                                 classification IN ('needs', 'wants', 'unnecessary', 'wasteful')
                             ),
            payee            TEXT,
            note             TEXT,
            frequency        TEXT    NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
            day_of_week      INTEGER,
            day_of_month     INTEGER,
            month_of_year    INTEGER,
            start_date       TEXT    NOT NULL,
            last_processed_date TEXT,
            is_active        INTEGER NOT NULL DEFAULT 1,
            created_on       TEXT    NOT NULL,
            modified_on      TEXT    NOT NULL,

            FOREIGN KEY (account_id)  REFERENCES accounts(account_id)  ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE RESTRICT,

            CHECK (
                (frequency = 'weekly'  AND day_of_week  BETWEEN 0 AND 6  AND day_of_month IS NULL AND month_of_year IS NULL)
                OR (frequency = 'monthly' AND day_of_month BETWEEN 1 AND 31 AND day_of_week  IS NULL AND month_of_year IS NULL)
                OR (frequency = 'yearly'  AND day_of_month BETWEEN 1 AND 31 AND month_of_year BETWEEN 1 AND 12 AND day_of_week IS NULL)
            )
        );

        INSERT INTO recurring_transactions_new SELECT * FROM recurring_transactions;

        DROP TABLE recurring_transactions;
        ALTER TABLE recurring_transactions_new RENAME TO recurring_transactions;

        CREATE INDEX IF NOT EXISTS idx_recurring_transactions_active   ON recurring_transactions(is_active);
        CREATE INDEX IF NOT EXISTS idx_recurring_transactions_frequency ON recurring_transactions(frequency);
        CREATE INDEX IF NOT EXISTS idx_recurring_transactions_account   ON recurring_transactions(account_id);
        CREATE INDEX IF NOT EXISTS idx_recurring_transactions_category  ON recurring_transactions(category_id);
    `)

    db.exec(`PRAGMA foreign_keys = ON`)
}
```

**What changes:** `account_id` and `classification` `NOT NULL` removed → nullable. All existing rows keep their values.

---

## What does NOT change

- The `transactions` table and all its types/services are completely untouched
- `CreateTransactionRequest.classification` remains required — all normal bank transaction creates still need a classification
- The UI classification field and all budget/report logic are unchanged
- Bank transactions generated by the portfolio service (debiting HDFC Savings to fund a buy) call `transactionService.createTransaction()` normally with `classification: 'needs'`
- Existing recurring transaction service validation still throws on `account_id = null` and `classification = null` for non-SIP creates (unchanged until Phase 5)

---

## Step 2 — Verify Migration Runs Clean

```ts
// In-memory DB test
const db = openInMemory()
runMigrations(db, [1, 2, 3, 4, 5, 6, 7, 8])  // migration 8 = this phase

// All existing recurring transaction operations must still work
const repo = new RecurringTransactionRepositoryImpl(db)

// Create a regular recurring transaction — account_id still required by service validation
recurringTransactionService.createRecurringTransaction({
    account_id: existingAccountId,
    transaction_type: 'withdraw',
    amount: 5000,
    classification: 'needs',
    frequency: 'monthly',
    day_of_month: 1,
    start_date: new Date(),
})
// → should succeed, same as before
```

---

## Tests

- [ ] Migration 8 runs cleanly on a fresh profile
- [ ] Migration 8 runs cleanly on a profile with existing recurring transactions (all rows preserved)
- [ ] After migration: creating a regular recurring transaction with all required fields still works
- [ ] After migration: creating a regular recurring transaction without `account_id` still throws (service validation unchanged)
- [ ] `SELECT * FROM recurring_transactions` after migration returns the same rows as before
- [ ] `tsc --noEmit` — no TypeScript errors

---

## Verify — Definition of Done

- [ ] `npm test` — all existing recurring transaction tests pass (zero regressions)
- [ ] `npm test` — all existing transaction tests pass (transactions table not touched — confirm zero regressions)
- [ ] `npm run dev` — app opens cleanly; migration 8 runs without errors on a fresh profile
- [ ] App opens cleanly on a profile with existing recurring transactions (data preserved)
- [ ] `PRAGMA table_info(recurring_transactions)` shows `account_id` and `classification` with `notnull = 0`
- [ ] `PRAGMA table_info(transactions)` shows `classification` with `notnull = 1` (unchanged)
