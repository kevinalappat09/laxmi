import * as fs from "fs";
import * as path from "path";

const PROFILE_FILES = [
    "profile.db",
    "profile.db-wal",
    "profile.db-shm",
    "preferences.json",
];

function restrictMode(filePath: string, mode: number, directory: boolean): void {
    let stat: fs.Stats;
    try {
        stat = fs.lstatSync(filePath);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
    }

    // Never chmod through a symlink to an unrelated user-selected path.
    if (directory ? !stat.isDirectory() : !stat.isFile()) return;
    fs.chmodSync(filePath, mode);
}

function restrictProfile(profilePath: string): void {
    let stat: fs.Stats;
    try {
        stat = fs.lstatSync(profilePath);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
    }
    if (!stat.isDirectory()) return;

    restrictMode(profilePath, 0o700, true);
    for (const filename of PROFILE_FILES) {
        restrictMode(path.join(profilePath, filename), 0o600, false);
    }
}

/** Protect existing application data; umask protects files created afterward. */
export function hardenProfileStorage(rootPath: string): void {
    if (process.platform === "win32") return; // Windows uses inherited ACLs.
    if (!fs.existsSync(rootPath)) return;

    restrictMode(rootPath, 0o700, true);
    restrictMode(path.join(rootPath, "global_preferences.json"), 0o600, false);

    const profilesPath = path.join(rootPath, "profiles");
    const profilesStat = fs.existsSync(profilesPath) ? fs.lstatSync(profilesPath) : null;
    if (profilesStat?.isDirectory()) {
        restrictMode(profilesPath, 0o700, true);
        for (const entry of fs.readdirSync(profilesPath, { withFileTypes: true })) {
            if (entry.isDirectory()) restrictProfile(path.join(profilesPath, entry.name));
        }
    }

    // Migration can leave a legacy profile at the root when its target name
    // already exists. Restrict that data as well without touching Electron caches.
    for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name === "profiles") continue;
        const candidate = path.join(rootPath, entry.name);
        if (PROFILE_FILES.some((name) => fs.existsSync(path.join(candidate, name)))) {
            restrictProfile(candidate);
        }
    }
}
