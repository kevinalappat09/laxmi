/**
 * @module profileLayoutMigration
 * @description Relocates profiles stored in the root data directory into the profiles subdirectory.
 * @stability stable
 */

### Functions

| Signature | Description |
|-----------|------------|
| migrateProfileLayout(): Promise<string[]> | Moves legacy root level profiles into the profiles directory and returns the moved profile names. |

Notes:
- Identifies a profile by the presence of `profile.db` or `preferences.json`, which excludes Electron runtime directories.
- Skips any profile whose name already exists in the profiles directory instead of overwriting it.

### Design Decisions

Decision: Detects pending work by inspecting the filesystem rather than storing a migration version.
Reason: The root data directory contains no profile directories once the move completes, making the operation self describing and idempotent.
Impact: No version field is added to `global_preferences.json`, and a partially completed move is finished on the next run.

### Errors

- Throws when `readdir`, `mkdir`, or `rename` fails, and the caller in `main.ts` logs the error and continues startup.
