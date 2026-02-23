import {
    getRootDataDirectory,
    getProfileDirectory,
    getProfilePreferencesPath,
    getProfileDbPath,
} from '../path/pathService';

import {
    setLastOpenedProfile,
    loadPreferences,
} from '../globalPreferences/globalPreferencesService';

import {
    openDatabase,
    initializeSchema,
    closeDatabase,
    SQLiteDatabase,
} from '../../database/databaseService';

import { MigrationService } from '../migration/migrationService';
import { validateProfileName } from '../../utils/profileValidator';
import * as fs from 'fs';
import { profileSessionService } from '../profileSession/profileSessionService';

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

async function initializeProfileDb(
    profileName: string,
    migrationService: MigrationService
): Promise<void> {
    const dbPath = getProfileDbPath(profileName);
    const db = openDatabase(dbPath);

    initializeSchema(db);
    migrationService.migrate(db);
    closeDatabase(db);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function listProfiles(): Promise<string[]> {
    const appDataPath = getRootDataDirectory();

    const entries = await fs.promises.readdir(appDataPath, {
        withFileTypes: true,
    });

    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
}

export async function createProfile(
    profileName: string,
    migrationService: MigrationService
): Promise<void> {
    const existingProfiles = await listProfiles();

    const validationResult = validateProfileName(
        profileName,
        existingProfiles
    );

    if (!validationResult.isValid) {
        throw new Error(validationResult.errors.join(', '));
    }

    const profilePath = getProfileDirectory(profileName);

    if (fs.existsSync(profilePath)) {
        throw new Error(
            `Profile with name '${profileName}' already exists.`
        );
    }

    await fs.promises.mkdir(profilePath);

    const preferencesPath = getProfilePreferencesPath(profileName);
    await fs.promises.writeFile(
        preferencesPath,
        JSON.stringify({}, null, 2)
    );

    await initializeProfileDb(profileName, migrationService);
}

export async function deleteProfile(profileName: string): Promise<void> {
    const profilePath = getProfileDirectory(profileName);

    if (!fs.existsSync(profilePath)) {
        throw new Error(
            `Profile with name '${profileName}' does not exist.`
        );
    }

    const globalPrefs = await loadPreferences();

    if (globalPrefs.last_opened_profile === profileName) {
        await setLastOpenedProfile(null);
    }

    await fs.promises.rm(profilePath, {
        recursive: true,
        force: true,
    });
}

export async function openProfile(
    profileName: string,
    migrationService: MigrationService
): Promise<SQLiteDatabase> {
    const profilePath = getProfileDirectory(profileName);

    if (!fs.existsSync(profilePath)) {
        throw new Error(
            `Profile with name '${profileName}' does not exist.`
        );
    }

    const dbPath = getProfileDbPath(profileName);
    const dbExists = fs.existsSync(dbPath);

    const db = openDatabase(dbPath);

    if (!dbExists) {
        initializeSchema(db);
        closeDatabase(db);
    }

    migrationService.migrate(db);

    profileSessionService.setDatabaseConnection(db);
    await setLastOpenedProfile(profileName);

    return db;
}