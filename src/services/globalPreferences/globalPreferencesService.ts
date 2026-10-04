import * as fs from "fs/promises";
import { getGlobalPreferencesPath } from "../path/pathService";

export type Appearance = "solid" | "glass";
export type Theme = "dark" | "light";
export type TextSize = "default" | "large" | "larger";

export interface GlobalPreferences {
    last_opened_profile: string | null;
    theme: Theme;
    appearance: Appearance;
    text_size: TextSize;
}

const DEFAULT_GLOBAL_PREFERENCES: GlobalPreferences = {
    last_opened_profile: null,
    theme: "dark",
    appearance: "solid",
    text_size: "default",
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

function normalizeAppearance(value: unknown): Appearance {
    return value === "glass" ? "glass" : "solid";
}

function normalizeTheme(value: unknown): Theme {
    return value === "light" ? "light" : "dark";
}

function normalizeTextSize(value: unknown): TextSize {
    if (value === "large" || value === "larger") {
        return value;
    }
    return "default";
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
            theme: normalizeTheme(prefs.theme),
            appearance: normalizeAppearance(prefs.appearance),
            text_size: normalizeTextSize(prefs.text_size),
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
    const prefs = await loadPreferences();
    await savePreferences({ ...prefs, last_opened_profile: profileName });
}

export async function getTheme(): Promise<Theme> {
    const prefs = await loadPreferences();
    return prefs.theme;
}

export async function setTheme(theme: Theme): Promise<void> {
    const prefs = await loadPreferences();
    await savePreferences({ ...prefs, theme: normalizeTheme(theme) });
}

export async function getAppearance(): Promise<Appearance> {
    const prefs = await loadPreferences();
    return prefs.appearance;
}

export async function setAppearance(appearance: Appearance): Promise<void> {
    const prefs = await loadPreferences();
    await savePreferences({ ...prefs, appearance });
}

export async function getTextSize(): Promise<TextSize> {
    const prefs = await loadPreferences();
    return prefs.text_size;
}

export async function setTextSize(textSize: TextSize): Promise<void> {
    const prefs = await loadPreferences();
    await savePreferences({ ...prefs, text_size: normalizeTextSize(textSize) });
}

export async function resetPreferences(): Promise<void> {
    await savePreferences(DEFAULT_GLOBAL_PREFERENCES);
}
