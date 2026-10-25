import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { writePrivateCsv } from "./privateCsvFile";

const unixTest = process.platform === "win32" ? test.skip : test;

describe("writePrivateCsv", () => {
    unixTest("restricts both new and existing exports before replacing contents", () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), "laxmi-export-"));
        try {
            const fresh = path.join(directory, "fresh.csv");
            const existing = path.join(directory, "existing.csv");
            fs.writeFileSync(existing, "old,contents\n");
            fs.chmodSync(existing, 0o666);

            writePrivateCsv(fresh, "new,contents\n");
            writePrivateCsv(existing, "replaced\n");

            expect(fs.readFileSync(fresh, "utf8")).toBe("new,contents\n");
            expect(fs.readFileSync(existing, "utf8")).toBe("replaced\n");
            expect(fs.statSync(fresh).mode & 0o777).toBe(0o600);
            expect(fs.statSync(existing).mode & 0o777).toBe(0o600);
        } finally {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });
});
