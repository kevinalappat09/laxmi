/**
 * @module csvTemplateService
 * @description Generates and writes a CSV import template file to the user's Documents folder.
 * @stability stable
 */

import fs from "fs";
import path from "path";
import { app } from "electron";
import { CSVTemplateResult } from "../../types/csvImport";
import { CSVParser } from "./csvParser";

export interface CSVTemplateService {
    generateTemplate(): CSVTemplateResult;
}

export class CSVTemplateServiceImpl implements CSVTemplateService {
    private readonly csvParser = new CSVParser();

    generateTemplate(): CSVTemplateResult {
        const templateString = this.csvParser.generateTemplate();
        const savedPath = path.join(app.getPath("documents"), "laxmi-template.csv");
        fs.writeFileSync(savedPath, templateString, "utf-8");
        return { savedPath };
    }
}
