import * as fs from "fs/promises";
import { getGlobalPreferencesPath } from "../path/pathService";

export interface GlobalPreferences {
    last_opened_profile: string | null;
}

const DEFAULT_GLOBAL_PREFERENCES: GlobalPreferences = {
    last_opened_profile: null,
};

function normalizeLastOpenedProfile(value: unknown): string | null {
    if (typeof value === "string") {
        return value;
    }
    if (value === null || value === undefined) {
        return null;
    }
    return null;
}

export async function loadPreferences(): Promise<GlobalPreferences> {
    const prefsPath = getGlobalPreferencesPath();

    try {
        const fileContent = await fs.readFile(prefsPath, { encoding: "utf-8" });
        let parsed: unknown;

        try {
            parsed = JSON.parse(fileContent);
        } catch {
            return DEFAULT_GLOBAL_PREFERENCES;
        }

        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            return DEFAULT_GLOBAL_PREFERENCES;
        }

        const prefs = parsed as Record<string, unknown>;
        return {
            last_opened_profile: normalizeLastOpenedProfile(prefs.last_opened_profile),
        };
    } catch (error) {
        const errnoError = error as NodeJS.ErrnoException;
        if (errnoError.code === "ENOENT") {
            return DEFAULT_GLOBAL_PREFERENCES;
        }
        throw error;
    }
}

export async function savePreferences(prefs: GlobalPreferences): Promise<void> {
    const prefsPath = getGlobalPreferencesPath();
    const jsonContent = JSON.stringify(prefs, null, 2);
    await fs.writeFile(prefsPath, jsonContent, { encoding: "utf-8" });
}

export async function getLastOpenedProfile(): Promise<string | null> {
    const prefs = await loadPreferences();
    return prefs.last_opened_profile;
}

export async function setLastOpenedProfile(profileName: string | null): Promise<void> {
    await savePreferences({ last_opened_profile: profileName });
}

export async function resetPreferences(): Promise<void> {
    await savePreferences(DEFAULT_GLOBAL_PREFERENCES);
}
