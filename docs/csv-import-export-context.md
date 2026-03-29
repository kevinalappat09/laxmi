# CSV Import / Export — Feature Context

## 1. Project Architecture Overview

**App type:** Electron desktop app (no HTTP server, no REST API).

**Communication model:**
```
Renderer (React)
  → window.financeAPI.*  (contextBridge, preload.ts)
    → ipcRenderer.invoke(channel, ...args)
      → ipcMain.handle(channel, handler)  (main.ts)
        → ServiceImpl
          → RepositoryImpl
            → better-sqlite3 (profile.db per profile)
```

There is **no HTTP layer**. All "backend" code runs in the Electron main process. The renderer cannot touch the filesystem directly (contextIsolation=true, nodeIntegration=false).

**TypeScript compile target:** CommonJS, output to `dist/`. Source lives under `src/`.

---

## 2. Transaction Domain — Full Reference

### 2.1 Database Table (`transactions`)

```sql
transaction_id       INTEGER PRIMARY KEY AUTOINCREMENT
account_id           INTEGER NOT NULL  FK → accounts(account_id)
transaction_date     TEXT NOT NULL              -- stored as YYYY-MM-DD
transaction_type     TEXT NOT NULL              -- 'withdraw' | 'deposit' | 'transfer'
amount               DECIMAL NOT NULL CHECK(amount > 0)
category_id          INTEGER                    -- FK → categories(category_id), nullable
classification       TEXT NOT NULL              -- 'needs' | 'wants' | 'unnecessary' | 'wasteful'
payee                TEXT                       -- nullable (added in migration 4)
note                 TEXT                       -- nullable
transfer_account_id  INTEGER                    -- FK → accounts(account_id), nullable
is_active            INTEGER NOT NULL DEFAULT 1 -- soft delete flag (0 = deleted)
created_on           TEXT NOT NULL              -- ISO 8601 timestamp
modified_on          TEXT NOT NULL              -- ISO 8601 timestamp
```

### 2.2 TypeScript Enums

```
TransactionType: withdraw | deposit | transfer
Classification:  needs | wants | unnecessary | wasteful
```

### 2.3 `CreateTransactionRequest` (what the service accepts)

```ts
{
  account_id:          number        // required
  transaction_date:    Date          // required
  transaction_type:    TransactionType  // required
  amount:              number        // required, must be > 0
  category_id?:        number        // optional FK to categories
  classification:      Classification // required
  payee?:              string        // optional
  note?:               string        // optional
  transfer_account_id?: number       // optional, must differ from account_id
}
```

### 2.4 Validation rules enforced by `TransactionServiceImpl.createTransaction`

- `account_id`, `transaction_date`, `transaction_type`, `amount`, `classification` are required.
- `amount > 0`.
- Account with `account_id` must exist.
- If `category_id` is provided, category must exist.
- If `transfer_account_id` is provided, it must differ from `account_id` and that account must exist.

### 2.5 Existing IPC channel for single-transaction creation

- Channel: `create-transaction`
- Handler in `main.ts` coerces `request.transaction_date` to `new Date(...)` before delegating to `transactionService.createTransaction(request)`.

---

## 3. CSV Format Specification

The CSV file the user exports from their bank / other tools and imports into Laxmi.

### Columns (in order)

| Column | Format | Notes |
|--------|--------|-------|
| transaction_date | DD-MM-YYYY | Must be parsed to `Date` |
| payee | string | Free text, optional/empty allowed |
| amount | decimal | Always positive in the file; polarity is determined by `positiveAreDeposits` flag |
| category | string | Category name — must be matched or created |
| classification | string | One of: `needs`, `wants`, `unnecessary`, `wasteful` |
| note | string | Free text, optional/empty allowed |

### Polarity flag (`positiveAreDeposits`)

The renderer sends a boolean alongside the file:
- `true`  → positive amounts are **deposits**, negative amounts are **withdraws**
- `false` → positive amounts are **withdraws**, negative amounts are **deposits**

The absolute value of `amount` is stored in the DB (always `> 0`); `transaction_type` is derived from the sign + this flag.

### `transaction_type` derivation logic

```
if (positiveAreDeposits):
  positive  → TransactionType.Deposit
  negative  → TransactionType.Withdraw
else:
  positive  → TransactionType.Withdraw
  negative  → TransactionType.Deposit
```

Transfers are **not** representable in this CSV format. No `transfer_account_id` will ever be set during import.

---

## 4. How the Frontend Sends the File

### Why `dialog.showOpenDialog` (Electron) is the right approach

The renderer runs in a sandboxed web context (no Node, no FS access). There are two options:

**Option A — Electron `dialog.showOpenDialog` (recommended for this app):**
The main process opens the OS file picker via `dialog.showOpenDialog`, reads the file using Node's `fs.readFileSync`, and processes it entirely in the main process. The renderer only triggers the action and receives results back.

**Option B — HTML `<input type="file">` + `FileReader` API:**
The renderer uses a standard HTML file input. The user selects the file. The renderer reads the file content via the `FileReader` API (or `file.text()`), then sends the raw CSV string to the main process via IPC.

**This feature will use Option A** because:
- Consistent with the app's architecture (main process owns FS operations).
- No need to transfer potentially large binary data across IPC.
- File reading errors are handled in the main process where Node APIs are available.
- The renderer only needs to fire the IPC call and await the result.

### Renderer call (proposed)

```ts
window.financeAPI.importTransactionsFromCSV(accountId: number, positiveAreDeposits: boolean): Promise<ImportCSVResult>
```

The renderer passes `accountId` and `positiveAreDeposits`. The main process opens the OS file dialog, the user selects the CSV, and the main process does all the reading and parsing.

---

## 5. How the Main Process Receives and Processes It

### IPC channel: `import-transactions-csv`

**Arguments received from renderer:**
```ts
{
  accountId: number
  positiveAreDeposits: boolean
}
```

**Main process steps:**
1. Call `dialog.showOpenDialog({ filters: [{ name: 'CSV', extensions: ['csv'] }], properties: ['openFile'] })`.
2. If the user cancels (no file selected), return `{ cancelled: true }`.
3. Read the file with `fs.readFileSync(filePath, 'utf-8')`.
4. Pass raw CSV string + `accountId` + `positiveAreDeposits` to `TransactionImportService.importFromCSV(...)`.
5. Return `ImportCSVResult` to the renderer.

### Category matching strategy

The CSV includes a category **name** (string), not an ID. The import service needs to resolve or create categories.

**Lookup:** match by `category_name` (case-insensitive) using `CategoryRepositoryImpl`.
**No match found:** create a new root category with that name.
**Empty category field:** `category_id` is left as `undefined`.

### Row-level error handling

Each CSV row is processed independently. A row that fails validation (bad date, invalid classification, missing required field, etc.) is **skipped** and recorded in the result — it does not abort the entire import.

---

## 6. Import Result Type (proposed)

```ts
interface ImportCSVResult {
  cancelled?: boolean        // true if user dismissed the file dialog
  totalRows: number          // rows parsed from CSV (excluding header)
  successCount: number       // rows inserted successfully
  failedRows: FailedCSVRow[] // rows that failed with reasons
}

interface FailedCSVRow {
  rowNumber: number          // 1-based, excluding header
  rawData: string            // original CSV row text
  reason: string             // human-readable error description
}
```

---

## 7. Files to Create / Modify

### New files

| File | Purpose |
|------|---------|
| `src/services/transaction/transactionImportService.ts` | Parses CSV string, resolves categories, calls `TransactionRepositoryImpl.save` for each valid row |
| `src/types/csvImport.ts` | `ImportCSVResult`, `FailedCSVRow`, `CSVTransactionRow` types |

### Modified files

| File | What changes |
|------|-------------|
| `main.ts` | Add `ipcMain.handle("import-transactions-csv", ...)` handler; import `dialog` and `fs` |
| `preload.ts` | Expose `importTransactionsFromCSV(accountId, positiveAreDeposits)` on `window.financeAPI` |
| `renderer/src/types/global.d.ts` | Add `importTransactionsFromCSV` to the `financeAPI` type declaration |

---

## 8. CSV Export (future companion feature)

Not in scope for this implementation pass, but noted for planning:

- Channel: `export-transactions-csv`
- Arguments: `accountId: number`, optional filter params
- Main process: calls `dialog.showSaveDialog`, fetches transactions via `TransactionRepositoryImpl.findByAccountId`, serialises to CSV, writes with `fs.writeFileSync`.
- Polarity flag needed for export too (user chooses convention for the output file).

---

## 9. Patterns to Follow (from existing codebase)

### Service instantiation

Services are instantiated once in `main.ts` at module level and reused across IPC calls:
```ts
const transactionService = new TransactionServiceImpl()
```
The import service should follow the same pattern.

### Database connection access

Every service/repository method obtains the DB connection from:
```ts
const db = profileSessionService.getDatabaseConnection()
if (!db) throw new Error("No active database connection. Open a profile first.")
```

### Date storage

- `transaction_date` stored as `YYYY-MM-DD` string (via `date.toISOString().split('T')[0]`).
- `created_on` / `modified_on` stored as full ISO 8601 timestamp strings.

### Soft deletes

All deletes are soft (`is_active = 0`). Imports only create rows (`is_active = 1`).

### No ORMs, no external query builders

Raw parameterised SQL via `better-sqlite3`'s `.prepare().run()` / `.prepare().get()` / `.prepare().all()`.

### No HTTP, no multipart, no streams

All data exchange is synchronous in the main process. better-sqlite3 is fully synchronous.

---

## 10. Key Constraints and Edge Cases

| Constraint | Detail |
|-----------|--------|
| `amount > 0` | The DB has a CHECK constraint; the import must store the absolute value and derive `transaction_type` from sign + flag |
| Category by name | `categories` table has no unique constraint on `category_name`; the import should do a case-insensitive lookup and pick the first match to avoid duplicates |
| Date format | CSV uses DD-MM-YYYY; must parse to JS `Date` before passing to service |
| Classification validation | Must be one of the four allowed enum values; invalid values should fail the row |
| No transfer support | CSV has no `transfer_account_id` column; all imported transactions are `withdraw` or `deposit` |
| Account must exist | `account_id` comes from the renderer (user selects the account before triggering import) |
| Duplicate detection | No deduplication logic planned for v1; same row imported twice creates two transactions |
| Empty CSV | Should return `{ totalRows: 0, successCount: 0, failedRows: [] }` without error |
| Header row | First row is always the header and is always skipped |
