import * as fs from 'fs';
import * as path from 'path';

import {
    getRootDataDirectory,
    getProfilesDirectory,
    getProfileDirectory,
} from '../path/pathService';

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Files that identify a directory as a profile rather than an Electron
 * runtime directory such as Cache or Local Storage.
 */
const PROFILE_MARKER_FILES = ['profile.db', 'preferences.json'];

function looksLikeProfileDirectory(directoryPath: string): boolean {
    return PROFILE_MARKER_FILES.some((marker) =>
        fs.existsSync(path.join(directoryPath, marker))
    );
}

async function findLegacyProfileNames(): Promise<string[]> {
    const rootPath = getRootDataDirectory();

    if (!fs.existsSync(rootPath)) {
        return [];
    }

    const entries = await fs.promises.readdir(rootPath, {
        withFileTypes: true,
    });

    return entries
        .filter((entry) => entry.isDirectory())
        .filter((entry) => entry.name !== path.basename(getProfilesDirectory()))
        .filter((entry) =>
            looksLikeProfileDirectory(path.join(rootPath, entry.name))
        )
        .map((entry) => entry.name);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Moves profiles stored directly in the root data directory into the
 * "profiles" subdirectory, and returns the names that were moved.
 *
 * Profiles created before the "profiles" subdirectory existed are invisible
 * to listProfiles, so they are relocated once on startup. A profile whose
 * name already exists in the target directory is left untouched rather than
 * overwritten.
 */
export async function migrateProfileLayout(): Promise<string[]> {
    const legacyProfileNames = await findLegacyProfileNames();

    if (legacyProfileNames.length === 0) {
        return [];
    }

    const rootPath = getRootDataDirectory();
    await fs.promises.mkdir(getProfilesDirectory(), { recursive: true });

    const movedProfileNames: string[] = [];

    for (const profileName of legacyProfileNames) {
        const destinationPath = getProfileDirectory(profileName);

        if (fs.existsSync(destinationPath)) {
            continue;
        }

        await fs.promises.rename(
            path.join(rootPath, profileName),
            destinationPath
        );

        movedProfileNames.push(profileName);
    }

    return movedProfileNames;
}
