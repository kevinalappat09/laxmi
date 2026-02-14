/**
 * @module migrationService
 * @description Manages database schema migrations by applying versioned scripts.
 * @stability stable
 */

### Types

#### Migration

| Field | Type | Description |
|-------|------|------------|
| version | number | Identifies the unique version of the migration. |
| up | (db: SQLiteDatabase) => void | Defines the function to execute the migration logic. |

### Classes

#### MigrationService

Responsibility: Orchestrates the loading and application of database schema migrations.

##### Methods

| Signature | Description |
|-----------|------------|
| migrate(db: SQLiteDatabase): void | Applies pending migrations to the database based on the current schema version. |
