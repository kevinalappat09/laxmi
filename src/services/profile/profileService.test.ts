/* ------------------------------------------------------------------ */
/* MUST be at top — prevent native module loading                    */
/* ------------------------------------------------------------------ */
jest.mock('better-sqlite3', () => {
    return jest.fn().mockImplementation(() => ({
        prepare: jest.fn(),
        exec: jest.fn(),
        close: jest.fn(),
    }));
});

/* ------------------------------------------------------------------ */
/* Module Mocks (hoisted by Jest)                                     */
/* ------------------------------------------------------------------ */
jest.mock('../path/pathService');
jest.mock('../globalPreferences/globalPreferencesService');
jest.mock('../../database/databaseService');
jest.mock('../../utils/profileValidator');
jest.mock('fs', () => ({
    promises: {
        readdir: jest.fn(),
        mkdir: jest.fn(),
        writeFile: jest.fn(),
        rm: jest.fn(),
    },
    existsSync: jest.fn(),
}));
jest.mock('electron', () => ({
    app: {
        isPackaged: false,
    },
}));

/* ------------------------------------------------------------------ */
/* Imports AFTER mocks                                                */
/* ------------------------------------------------------------------ */
import {
    listProfiles,
    createProfile,
    deleteProfile,
    openProfile,
} from './profileService';

import { MigrationService } from '../migration/migrationService';

import {
    getRootDataDirectory,
    getProfileDirectory,
    getProfilePreferencesPath,
    getProfileDbPath,
} from '../path/pathService';

import {
    loadPreferences,
    setLastOpenedProfile,
} from '../globalPreferences/globalPreferencesService';

import {
    openDatabase,
    initializeSchema,
    closeDatabase,
} from '../../database/databaseService';

import { validateProfileName } from '../../utils/profileValidator';

import { promises as fsPromises, existsSync } from 'fs';

describe('profileService (module)', () => {
    let mockMigrationService: jest.Mocked<MigrationService>;
    const mockDb = {} as any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Fresh MigrationService each test
        const realMigrationService = new MigrationService('mock/migrations');
        mockMigrationService =
            realMigrationService as jest.Mocked<MigrationService>;
        mockMigrationService.migrate = jest.fn();

        /* ---------------- Default Safe Mocks ---------------- */

        jest.mocked(getRootDataDirectory).mockReturnValue('/mock/appData');

        jest.mocked(getProfileDirectory).mockImplementation(
            (name) => `/mock/appData/${name}`
        );

        jest.mocked(getProfilePreferencesPath).mockImplementation(
            (name) => `/mock/appData/${name}/preferences.json`
        );

        jest.mocked(getProfileDbPath).mockImplementation(
            (name) => `/mock/appData/${name}/profile.db`
        );

        jest.mocked(openDatabase).mockReturnValue(mockDb);
        jest.mocked(initializeSchema).mockReturnValue(undefined);
        jest.mocked(closeDatabase).mockReturnValue(undefined);

        jest.mocked(loadPreferences).mockResolvedValue({
            last_opened_profile: null,
        });

        jest.mocked(setLastOpenedProfile).mockResolvedValue(undefined);

        jest.mocked(validateProfileName).mockReturnValue({
            isValid: true,
            errors: [],
        });

        jest.mocked(existsSync).mockReturnValue(false);

        // Default: no profiles exist
        jest.mocked(fsPromises.readdir).mockResolvedValue([]);
    });

    /* ---------------------------------------------------------- */
    /* listProfiles                                               */
    /* ---------------------------------------------------------- */

    describe('listProfiles', () => {
        test('returns empty array if no profiles exist', async () => {
            const profiles = await listProfiles();
            expect(profiles).toEqual([]);
        });

        test('returns only directories', async () => {
            jest.mocked(fsPromises.readdir).mockResolvedValueOnce([
                { name: 'profile1', isDirectory: () => true },
                { name: 'profile2', isDirectory: () => true },
                { name: 'file.txt', isDirectory: () => false },
            ] as any);

            const profiles = await listProfiles();
            expect(profiles).toEqual(['profile1', 'profile2']);
        });
    });

    /* ---------------------------------------------------------- */
    /* createProfile                                              */
    /* ---------------------------------------------------------- */

    describe('createProfile', () => {
        test('creates new profile with valid name', async () => {
            await createProfile('NewProfile', mockMigrationService);

            expect(validateProfileName).toHaveBeenCalledWith(
                'NewProfile',
                []
            );

            expect(fsPromises.mkdir).toHaveBeenCalledWith(
                '/mock/appData/NewProfile'
            );

            expect(fsPromises.writeFile).toHaveBeenCalledWith(
                '/mock/appData/NewProfile/preferences.json',
                JSON.stringify({}, null, 2)
            );

            expect(openDatabase).toHaveBeenCalledWith(
                '/mock/appData/NewProfile/profile.db'
            );

            expect(initializeSchema).toHaveBeenCalledWith(mockDb);
            expect(mockMigrationService.migrate).toHaveBeenCalledWith(mockDb);
            expect(closeDatabase).toHaveBeenCalledWith(mockDb);
        });

        test('throws for invalid name', async () => {
            jest.mocked(validateProfileName).mockReturnValueOnce({
                isValid: false,
                errors: ['Invalid name'],
            });

            await expect(
                createProfile('BadName', mockMigrationService)
            ).rejects.toThrow('Invalid name');

            expect(fsPromises.mkdir).not.toHaveBeenCalled();
        });

        test('throws if profile already exists', async () => {
            jest.mocked(existsSync).mockReturnValueOnce(true);

            await expect(
                createProfile('ExistingProfile', mockMigrationService)
            ).rejects.toThrow(
                "Profile with name 'ExistingProfile' already exists."
            );
        });

        test('passes existing profiles to validator', async () => {
            jest.mocked(fsPromises.readdir).mockResolvedValueOnce([
                { name: 'profile1', isDirectory: () => true },
            ] as any);

            await createProfile('NewProfile', mockMigrationService);

            expect(validateProfileName).toHaveBeenCalledWith(
                'NewProfile',
                ['profile1']
            );
        });
    });

    /* ---------------------------------------------------------- */
    /* deleteProfile                                              */
    /* ---------------------------------------------------------- */

    describe('deleteProfile', () => {
        test('deletes existing profile', async () => {
            jest.mocked(existsSync).mockReturnValueOnce(true);

            await deleteProfile('ProfileToDelete');

            expect(fsPromises.rm).toHaveBeenCalledWith(
                '/mock/appData/ProfileToDelete',
                { recursive: true, force: true }
            );
        });

        test('resets last_opened_profile if needed', async () => {
            jest.mocked(existsSync).mockReturnValueOnce(true);

            jest.mocked(loadPreferences).mockResolvedValueOnce({
                last_opened_profile: 'LastOpenedProfile',
            });

            await deleteProfile('LastOpenedProfile');

            expect(setLastOpenedProfile).toHaveBeenCalledWith(null);
        });
    });

    /* ---------------------------------------------------------- */
    /* openProfile                                                */
    /* ---------------------------------------------------------- */

    describe('openProfile', () => {
        test('opens existing profile', async () => {
            jest.mocked(existsSync)
                .mockReturnValueOnce(true)  // profile exists
                .mockReturnValueOnce(true); // db exists

            const db = await openProfile(
                'ExistingProfile',
                mockMigrationService
            );

            expect(mockMigrationService.migrate).toHaveBeenCalledWith(mockDb);
            expect(setLastOpenedProfile).toHaveBeenCalledWith('ExistingProfile');
            expect(db).toBe(mockDb);
        });

        test('initializes db if missing', async () => {
            jest.mocked(existsSync)
                .mockReturnValueOnce(true)  // profile exists
                .mockReturnValueOnce(false); // db missing

            await openProfile(
                'ProfileWithMissingDb',
                mockMigrationService
            );

            expect(initializeSchema).toHaveBeenCalledWith(mockDb);
            expect(closeDatabase).toHaveBeenCalledWith(mockDb);
        });
    });
});
