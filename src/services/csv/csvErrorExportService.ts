/**
 * @module csvErrorExportService
 * @description Exports failed import rows back to a CSV file so the user can fix and re-import.
 * @stability stable
 */

import fs from "fs";
import path from "path";
import { dialog } from "electron";
import { CSVExportResult } from "../../types/csvImport";

export interface CSVErrorExportService {
    exportErrorRows(rawLines: string[]): Promise<CSVExportResult>;
}

export class CSVErrorExportServiceImpl implements CSVErrorExportService {
    async exportErrorRows(rawLines: string[]): Promise<CSVExportResult> {
        const today = new Date().toISOString().split("T")[0];
        const defaultFilename = `import-errors-${today}.csv`;

        const result = await dialog.showSaveDialog({
            title: "Save errored rows",
            defaultPath: path.join(defaultFilename),
            filters: [{ name: "CSV Files", extensions: ["csv"] }],
        });

        if (result.canceled || !result.filePath) {
            return { cancelled: true };
        }

        fs.writeFileSync(result.filePath, rawLines.join("\n"), "utf-8");

        return { cancelled: false, savedPath: result.filePath };
    }
}
