/**
 * @module accountService
 * @description Orchestrates account business logic and persistence operations.
 * @stability stable
 */

### Interfaces

#### AccountService

| Signature | Description |
|-----------|------------|
| createAccount(request: CreateAccountRequest): Account | Creates new account; validates color; assigns timestamps. |
| updateAccount(accountId: number, request: UpdateAccountRequest): Account | Updates account; merges updates with existing state; throws if not found. |
| deactivateAccount(accountId: number): void | Deactivates account and associated transactions; throws if not found. |
| getAccount(accountId: number): Account | Retrieves account by ID; throws if not found. |
| listActiveAccounts(): Account[] | Retrieves all active accounts. |

### Classes

#### AccountServiceImpl

Responsibility: Orchestrates account business logic and persistence operations.

##### Methods

| Signature | Description |
|-----------|------------|
| createAccount(request: CreateAccountRequest): Account | Creates new account with validation and timestamps. |
| updateAccount(accountId: number, request: UpdateAccountRequest): Account | Updates account with optional fields. |
| deactivateAccount(accountId: number): void | Deactivates account and cascades to transactions. |
| getAccount(accountId: number): Account | Retrieves single account. |
| listActiveAccounts(): Account[] | Retrieves all active accounts. |

Design Notes:
- Obtains database connection from profileSessionService.
- Delegates all database operations to AccountRepositoryImpl.
- Validates hex color format (#RRGGBB) before persistence.

### Design Decisions

Decision: Service creates new repository instance per operation.
Reason: Keeps repository stateless; simplifies testing and composition.
Impact: Minor performance overhead mitigated by lightweight instantiation.

Decision: Hex color validation happens in service, not database.
Reason: Application-level validation provides immediate feedback to client.
Impact: Database constraints not enforced; application is single consumer.

Decision: UpdateAccountRequest fields are optional for partial updates.
Reason: Frontend sends only changed fields; service merges with existing state.
Impact: modified_on always updated; is_active can be set explicitly.

### Errors

- Throws error when no active database connection (profile not open).
- Throws error when account not found on update, deactivate, or get operations.
- Throws error when color format is invalid (not hex #RRGGBB).
