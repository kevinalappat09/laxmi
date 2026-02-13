# globalPreferencesService

## Module Header

```ts
/**
 * @module globalPreferencesService
 * @description Manages loading and saving of global_preferences.json file in root data directory.
 * @stability stable
 */
```

## Constants

| Name | Type | Description |
|------|------|-------------|
| DEFAULT_GLOBAL_PREFERENCES | GlobalPreferences | Default preferences returned when file is missing or invalid. |

## Types

#### GlobalPreferences

| Field | Type | Description |
|-------|------|-------------|
| last_opened_profile | string \| null | Profile name that was last opened, or null if none. |

## Functions

| Signature | Description |
|-----------|-------------|
| loadPreferences(): Promise\<GlobalPreferences\> | Loads preferences from file, returns defaults if file missing or invalid. |
| savePreferences(prefs: GlobalPreferences): Promise\<void\> | Writes preferences directly to file, overwriting existing content. |
| getLastOpenedProfile(): Promise\<string \| null\> | Returns last_opened_profile value from preferences. |
| setLastOpenedProfile(profileName: string \| null): Promise\<void\> | Updates last_opened_profile and saves preferences. |
| resetPreferences(): Promise\<void\> | Overwrites file with default preferences. |

Notes:
- loadPreferences ignores unknown fields in JSON file.
- savePreferences writes exactly what is passed, no merging occurs.
- Non-ENOENT file system errors propagate to caller.

## Design Decisions

Decision: Interface contains only explicitly declared fields, no index signature.
Reason: Ensures type safety and makes adding new preferences an explicit change.
Impact: Unknown fields in JSON are ignored, file contents match interface exactly.

Decision: savePreferences writes directly without reading existing file first.
Reason: Simplifies implementation and ensures file contents always match interface.
Impact: Updating one field requires loading current preferences first, then saving complete object.

## Extension Guidelines

- Add new field to GlobalPreferences interface.
- Add default value to DEFAULT_GLOBAL_PREFERENCES constant.
- Add normalization function if field has constraints.
- Update loadPreferences return statement to include normalized new field.
- Consider adding convenience getter/setter functions following existing pattern.

## Errors

- Throws file system errors when read or write operations fail (non-ENOENT).
- Returns DEFAULT_GLOBAL_PREFERENCES when file missing (ENOENT).
- Returns DEFAULT_GLOBAL_PREFERENCES when JSON invalid or not an object.
- Normalizes invalid last_opened_profile types to null.
