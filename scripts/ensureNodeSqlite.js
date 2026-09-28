/**
 * Jest runs on Node. postinstall rebuilds better-sqlite3 for Electron, which
 * uses a different ABI. Rebuild for the current Node when that binary will not load.
 *
 * The probe runs in a child process so a mismatched addon cannot crash this process.
 */
const { execFileSync, execSync } = require("child_process");

const probe = `
const Database = require("better-sqlite3");
const db = new Database(":memory:");
db.close();
`;

function sqliteLoads() {
    try {
        execFileSync(process.execPath, ["-e", probe], { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

if (!sqliteLoads()) {
    execSync("npm rebuild better-sqlite3", { stdio: "inherit" });
    if (!sqliteLoads()) {
        console.error("better-sqlite3 still failed to load for this Node after rebuild.");
        process.exit(1);
    }
}
