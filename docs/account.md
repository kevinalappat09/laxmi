/**
 * @module account
 * @description Defines Account domain types, enums, and request/response DTOs.
 * @stability stable
 */

### Enums

#### AccountType

| Value | Description |
|-------|------------|
| Asset | Account classified as an asset. |
| Liability | Account classified as a liability. |

#### AccountSubType

| Value | Description |
|-------|------------|
| Savings | Savings account. |
| Checking | Checking account. |
| Salary | Salary account. |
| Credit | Credit account. |
| Investment | Investment account. |

### Types

#### Account

| Field | Type | Description |
|-------|------|------------|
| account_id | number | Unique account identifier assigned by database. |
| institution_name | string | Name of the financial institution. |
| account_name | string | User-friendly account name. |
| account_type | AccountType | Asset or Liability classification. |
| sub_type | AccountSubType | Specific account category. |
| color | string | Hex color code for UI display. |
| opened_on | Date | Account opening date. |
| created_on | Date | Record creation timestamp. |
| modified_on | Date | Last modification timestamp. |
| is_active | boolean | Soft delete flag; false indicates deactivated. |

#### CreateAccountRequest

| Field | Type | Description |
|-------|------|------------|
| institution_name | string | Name of the financial institution. |
| account_name | string | User-friendly account name. |
| account_type | AccountType | Asset or Liability classification. |
| sub_type | AccountSubType | Specific account category. |
| color | string | Hex color code for UI display. |
| opened_on | Date | Account opening date. |

#### UpdateAccountRequest

| Field | Type | Description |
|-------|------|------------|
| institution_name | string \| undefined | Name of the financial institution. |
| account_name | string \| undefined | User-friendly account name. |
| account_type | AccountType \| undefined | Asset or Liability classification. |
| sub_type | AccountSubType \| undefined | Specific account category. |
| color | string \| undefined | Hex color code for UI display. |
| opened_on | Date \| undefined | Account opening date. |
| is_active | boolean \| undefined | Soft delete flag. |

### Design Decisions

Decision: All UpdateAccountRequest fields are optional.
Reason: Enables partial updates from the frontend.
Impact: Service layer merges updates with existing account state.

### Errors

- Throws error when color format is invalid (not hex #RRGGBB).
