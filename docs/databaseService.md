/**
 * @module databaseService
 * @description Handles SQLite connection lifecycle and core schema initialization.
 * @stability stable
 */

### Types

#### SQLiteDatabase

| Field | Type | Description |
|-------|------|------------|
| N/A   | Database.Database | Represents an instance of a SQLite database connection. |

### Functions

| Signature | Description |
|-----------|------------|
| openDatabase(profileDirectory: string): SQLiteDatabase | Establishes and returns a new SQLite database connection. |
| closeDatabase(db: SQLiteDatabase): void | Closes the provided SQLite database connection. |
| initializeSchema(db: SQLiteDatabase): void | Initializes the `_schema` table if it does not already exist. |
| getCurrentSchemaVersion(db: SQLiteDatabase): number | Retrieves the current schema version from the `_schema` table. |
| setSchemaVersion(db: SQLiteDatabase, version: number): void | Sets the schema version in the `_schema` table. |

### Errors

- Throws Error when _schema table is not initialized. |
