# Path Service

The `pathService` centralizes all logic related to resolving filesystem paths for the Laxmi application, ensuring that all parts of the app use the same conventions for where data is stored.

## Responsibilities

- Determine the base application data directory for the current platform.
- Compute the root Laxmi data directory name based on the environment (`Laxmi` vs `Laxmi-Dev`).
- Provide helper functions to resolve paths for:
  - Global preferences (`global_preferences.json`).
  - Per-profile directories and their `preferences.json` files.

## Platform Base Paths

The base paths are derived from the user's home directory and `process.platform`:

- **Windows (`win32`)**: `C:\Users\<User>\AppData\Roaming\`
- **macOS (`darwin`)**: `/Users/<User>/Library/Application Support/`
- **Linux / Other**: `/home/<User>/.config/`

These are calculated using:

- `os.homedir()` – to determine the current user's home directory.
- `getBaseAppDataPathFor(platform, homeDir)` – to map the platform + home directory to the platform-specific base app data path.

## Root Data Directory

The root Laxmi data directory is derived from the base app data path and the current environment:

- In **development** (`isDev() === true`): the folder name is `Laxmi-Dev`.
- In **production** (`isDev() === false`): the folder name is `Laxmi`.

This is implemented by:

- `getRootDataDirectory(): string`
  - Uses `process.platform`, `os.homedir()`, and `getBaseAppDataPathFor(...)`.
  - Uses `isDev()` from `environmentService` to choose the folder name.

## Global Preferences Path

- `getGlobalPreferencesPath(): string`
  - Returns the absolute path to `global_preferences.json` at the root of the Laxmi data directory.
  - Example (Windows, dev):
    - `C:\Users\<User>\AppData\Roaming\Laxmi-Dev\global_preferences.json`

## Profile Paths

- `getProfileDirectory(profileName: string): string`
  - Returns the directory path for a given profile under the root data directory.
  - Example (macOS, prod):
    - `/Users/<User>/Library/Application Support/Laxmi/MyProfile`

- `getProfilePreferencesPath(profileName: string): string`
  - Returns the path to the `preferences.json` file for a given profile.
  - Example (Linux, dev):
    - `/home/<User>/.config/Laxmi-Dev/MyProfile/preferences.json`

> Note: The `pathService` only resolves paths and does not perform any file system operations or validate profile names. Validation and IO are handled by other services (e.g., profile validator, profile service).

