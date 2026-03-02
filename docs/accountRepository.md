/**
 * @module accountRepository
 * @description Provides direct database access for Account entities.
 * @stability stable
 */

### Interfaces

#### AccountRepository

| Signature | Description |
|-----------|------------|
| save(account: Account): Account | Inserts new account or updates existing; returns saved account with ID. |
| findById(accountId: number): Account \| null | Retrieves account by ID or returns null if not found. |
| findAllActive(): Account[] | Returns all active accounts ordered by account_id. |
| findByType(type: AccountType): Account[] | Returns accounts matching specified type ordered by account_id. |
| deactivate(accountId: number): void | Deactivates account and its associated transactions in single transaction. |

### Classes

#### AccountRepositoryImpl

Responsibility: Direct SQLite database access for Account persistence.

##### Methods

| Signature | Description |
|-----------|------------|
| constructor(db: SQLiteDatabase) | Initializes repository with database connection. |
| save(account: Account): Account | Inserts new or updates existing account. |
| findById(accountId: number): Account \| null | Retrieves account by ID. |
| findAllActive(): Account[] | Retrieves all active accounts. |
| findByType(type: AccountType): Account[] | Retrieves accounts by type. |
| deactivate(accountId: number): void | Deactivates account and transactions. |

Design Notes:
- Requires active SQLiteDatabase connection passed at construction.
- Throws if database connection is null on any operation.

### Design Decisions

Decision: Row-to-Account mapping converts SQLite TEXT dates to Date objects.
Reason: Database stores ISO strings; service layer works with Date objects.
Impact: Transparent conversion at repository boundary.

Decision: Deactivate wraps account and transaction updates in single transaction.
Reason: Ensures cascade consistency if process fails mid-operation.
Impact: All-or-nothing semantics for cascading deactivations.

### Errors

- Throws error when database connection is null or undefined.
