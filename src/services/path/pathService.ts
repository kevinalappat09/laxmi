import * as os from "os";
import * as path from "path";
import { app } from "electron";
/**
 * Returns the base application data directory for a given platform and home directory.
 *
 * Windows  -> C:\Users\<User>\AppData\Roaming
 * macOS    -> /Users/<User>/Library/Application Support
 * Linux/*  -> /home/<User>/.config
 */
export function getBaseAppDataPathFor(platform: NodeJS.Platform, homeDir: string): string {
    switch (platform) {
        case "win32":
            return path.join(homeDir, "AppData", "Roaming");
        case "darwin":
            return path.join(homeDir, "Library", "Application Support");
        default:
            // Treat all other platforms as Linux-like for our purposes.
            return path.join(homeDir, ".config");
    }
}

/**
 * Returns the root data directory for the Laxmi application.
 *
 * - Uses the appropriate base app data path for the current platform.
 * - Appends "Laxmi-Dev" when running in development mode.
 * - Appends "Laxmi" when running in production mode.
 */
export function getRootDataDirectory(): string {
    const homeDir = os.homedir();
    const baseAppDataPath = getBaseAppDataPathFor(process.platform, homeDir);

    const appFolderName = app.isPackaged ? "Laxmi" : "Laxmi-Dev";

    return path.join(baseAppDataPath, appFolderName);
}

/**
 * Returns the path to the global preferences JSON file under the root data directory.
 */
export function getGlobalPreferencesPath(): string {
    return path.join(getRootDataDirectory(), "global_preferences.json");
}

/**
 * Returns the directory path for the given profile name under the root data directory.
 * This function only resolves the path and does not perform any IO or validation.
 */
export function getProfileDirectory(profileName: string): string {
    return path.join(getRootDataDirectory(), profileName);
}

/**
 * Returns the path to the preferences.json file for the given profile.
 */
export function getProfilePreferencesPath(profileName: string): string {
    return path.join(getProfileDirectory(profileName), "preferences.json");
}

/**
 * Returns the path to the database file for the given profile.
 */
export function getProfileDbPath(profileName: string): string {
    return path.join(getProfileDirectory(profileName), "profile.db");
}
