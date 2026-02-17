/**
 * @module profileService
 * @description Manages profile lifecycle including listing, creation, deletion, and database initialization.
 * @stability stable
 */

### Types

#### SQLiteDatabase

| Field | Type | Description |
|-------|------|------------|
| N/A   | SQLiteDatabase | Represents an active SQLite database connection associated with a profile. |

---

### Functions

| Signature | Description |
|-----------|------------|
| listProfiles(): Promise<string[]> | Retrieves all existing profile directory names from the root data directory. |
| createProfile(profileName: string, migrationService: MigrationService): Promise<void> | Creates a new profile directory, initializes preferences, creates a database, and runs migrations. |
| deleteProfile(profileName: string): Promise<void> | Deletes a profile directory and resets global preferences if it was the last opened profile. |
| openProfile(profileName: string, migrationService: MigrationService): Promise<SQLiteDatabase> | Opens an existing profile database, initializes it if missing, runs migrations, updates global preferences, and returns the database connection. |

---

### Behavior

- Profile data is stored inside the application root data directory.
- Each profile contains:
  - A dedicated directory
  - A `preferences.json` file
  - A SQLite database file
- Database schema initialization and migrations are executed during:
  - Profile creation
  - Profile opening (if required)
- Global preferences are updated when:
  - A profile is opened
  - The last opened profile is deleted

---

### Errors

- Throws `Error` if a profile name fails validation.
- Throws `Error` if attempting to create a profile that already exists.
- Throws `Error` if attempting to delete or open a non-existent profile.
- Throws underlying filesystem errors if directory operations fail.
- Throws migration-related errors if database initialization fails.

---

### Internal Helpers (Not Exported)

| Function | Description |
|----------|------------|
| initializeProfileDb(profileName: string, migrationService: MigrationService): Promise<void> | Creates a new database file for the profile, initializes schema, runs migrations, and closes the connection. |