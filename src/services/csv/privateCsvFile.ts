import * as fs from "fs";

/** Write an export only after restricting an existing target's permissions. */
export function writePrivateCsv(filePath: string, contents: string): void {
    const fd = fs.openSync(
        filePath,
        fs.constants.O_WRONLY | fs.constants.O_CREAT,
        0o600
    );
    try {
        if (process.platform !== "win32") fs.fchmodSync(fd, 0o600);
        fs.ftruncateSync(fd, 0);
        fs.writeFileSync(fd, contents, "utf-8");
    } finally {
        fs.closeSync(fd);
    }
}
