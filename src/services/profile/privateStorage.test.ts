import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { hardenProfileStorage } from "./privateStorage";

const unixTest = process.platform === "win32" ? test.skip : test;

describe("hardenProfileStorage", () => {
    unixTest("restricts existing profile data without changing unrelated files or symlink targets", () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "laxmi-private-"));
        try {
            const profile = path.join(root, "profiles", "Personal");
            const legacy = path.join(root, "Legacy");
            const cache = path.join(root, "Cache");
            fs.mkdirSync(profile, { recursive: true });
            fs.mkdirSync(legacy);
            fs.mkdirSync(cache);
            const database = path.join(profile, "profile.db");
            const wal = path.join(profile, "profile.db-wal");
            const preferences = path.join(root, "global_preferences.json");
            const legacyDatabase = path.join(legacy, "profile.db");
            const cacheFile = path.join(cache, "cache.txt");
            const external = path.join(root, "external.txt");
            for (const filename of [database, preferences, legacyDatabase, cacheFile, external]) {
                fs.writeFileSync(filename, "private data");
                fs.chmodSync(filename, 0o666);
            }
            fs.symlinkSync(external, wal);
            for (const directory of [root, path.join(root, "profiles"), profile, legacy]) {
                fs.chmodSync(directory, 0o755);
            }

            hardenProfileStorage(root);

            const mode = (filename: string) => fs.statSync(filename).mode & 0o777;
            expect(mode(root)).toBe(0o700);
            expect(mode(path.join(root, "profiles"))).toBe(0o700);
            expect(mode(profile)).toBe(0o700);
            expect(mode(legacy)).toBe(0o700);
            expect(mode(database)).toBe(0o600);
            expect(mode(preferences)).toBe(0o600);
            expect(mode(legacyDatabase)).toBe(0o600);
            expect(mode(cacheFile)).toBe(0o666);
            expect(mode(external)).toBe(0o666);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
