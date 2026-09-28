/* ------------------------------------------------------------------ */
/* Module Mocks (hoisted by Jest)                                     */
/* ------------------------------------------------------------------ */
jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(() => '/mock/appData'),
        isPackaged: false,
    },
}));
jest.mock('../path/pathService');
jest.mock('fs', () => ({
    promises: {
        readdir: jest.fn(),
        mkdir: jest.fn(),
        rename: jest.fn(),
    },
    existsSync: jest.fn(),
}));

/* ------------------------------------------------------------------ */
/* Imports AFTER mocks                                                */
/* ------------------------------------------------------------------ */
import * as path from 'path';

import { migrateProfileLayout } from './profileLayoutMigration';

import {
    getRootDataDirectory,
    getProfilesDirectory,
    getProfileDirectory,
} from '../path/pathService';

import { promises as fsPromises, existsSync } from 'fs';

const ROOT = path.join('/mock', 'appData');
const PROFILES = path.join(ROOT, 'profiles');

function dirEntry(name: string) {
    return { name, isDirectory: () => true } as any;
}

function fileEntry(name: string) {
    return { name, isDirectory: () => false } as any;
}

/**
 * Marks the given absolute paths as existing; everything else is absent.
 */
function existingPaths(...paths: string[]): void {
    jest.mocked(existsSync).mockImplementation((target) =>
        paths.includes(target as string)
    );
}

describe('profileLayoutMigration', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        jest.mocked(getRootDataDirectory).mockReturnValue(ROOT);
        jest.mocked(getProfilesDirectory).mockReturnValue(PROFILES);
        jest.mocked(getProfileDirectory).mockImplementation((name) =>
            path.join(PROFILES, name)
        );

        jest.mocked(fsPromises.readdir).mockResolvedValue([] as any);
        jest.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
        jest.mocked(fsPromises.rename).mockResolvedValue(undefined);

        existingPaths(ROOT);
    });

    test('moves a legacy profile into the profiles directory', async () => {
        jest.mocked(fsPromises.readdir).mockResolvedValue([
            dirEntry('MyProfile'),
        ] as any);

        existingPaths(ROOT, path.join(ROOT, 'MyProfile', 'profile.db'));

        const moved = await migrateProfileLayout();

        expect(moved).toEqual(['MyProfile']);

        expect(fsPromises.mkdir).toHaveBeenCalledWith(PROFILES, {
            recursive: true,
        });

        expect(fsPromises.rename).toHaveBeenCalledWith(
            path.join(ROOT, 'MyProfile'),
            path.join(PROFILES, 'MyProfile')
        );
    });

    test('treats a directory with only preferences.json as a profile', async () => {
        jest.mocked(fsPromises.readdir).mockResolvedValue([
            dirEntry('NoDbYet'),
        ] as any);

        existingPaths(ROOT, path.join(ROOT, 'NoDbYet', 'preferences.json'));

        await expect(migrateProfileLayout()).resolves.toEqual(['NoDbYet']);
    });

    test('ignores electron runtime directories and root level files', async () => {
        jest.mocked(fsPromises.readdir).mockResolvedValue([
            dirEntry('Cache'),
            dirEntry('GPUCache'),
            dirEntry('Local Storage'),
            fileEntry('global_preferences.json'),
        ] as any);

        const moved = await migrateProfileLayout();

        expect(moved).toEqual([]);
        expect(fsPromises.rename).not.toHaveBeenCalled();
        expect(fsPromises.mkdir).not.toHaveBeenCalled();
    });

    test('does not recurse into the profiles directory itself', async () => {
        jest.mocked(fsPromises.readdir).mockResolvedValue([
            dirEntry('profiles'),
        ] as any);

        existingPaths(ROOT, path.join(PROFILES, 'profile.db'));

        const moved = await migrateProfileLayout();

        expect(moved).toEqual([]);
        expect(fsPromises.rename).not.toHaveBeenCalled();
    });

    test('leaves an existing target profile untouched', async () => {
        jest.mocked(fsPromises.readdir).mockResolvedValue([
            dirEntry('Clash'),
        ] as any);

        existingPaths(
            ROOT,
            path.join(ROOT, 'Clash', 'profile.db'),
            path.join(PROFILES, 'Clash')
        );

        const moved = await migrateProfileLayout();

        expect(moved).toEqual([]);
        expect(fsPromises.rename).not.toHaveBeenCalled();
    });

    test('moves only the legacy profiles when the layout is partly migrated', async () => {
        jest.mocked(fsPromises.readdir).mockResolvedValue([
            dirEntry('Legacy'),
            dirEntry('Cache'),
            dirEntry('profiles'),
        ] as any);

        existingPaths(ROOT, path.join(ROOT, 'Legacy', 'profile.db'));

        const moved = await migrateProfileLayout();

        expect(moved).toEqual(['Legacy']);
        expect(fsPromises.rename).toHaveBeenCalledTimes(1);
    });

    test('is a no-op when the root data directory does not exist', async () => {
        existingPaths();

        const moved = await migrateProfileLayout();

        expect(moved).toEqual([]);
        expect(fsPromises.readdir).not.toHaveBeenCalled();
        expect(fsPromises.mkdir).not.toHaveBeenCalled();
    });

    test('is idempotent once the profiles have been moved', async () => {
        jest.mocked(fsPromises.readdir).mockResolvedValue([
            dirEntry('profiles'),
            dirEntry('Cache'),
        ] as any);

        await expect(migrateProfileLayout()).resolves.toEqual([]);
        expect(fsPromises.rename).not.toHaveBeenCalled();
    });
});
