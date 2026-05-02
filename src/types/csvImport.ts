/**
 * @module csvImport
 * @description Defines types and DTOs for the CSV import/export feature.
 * @stability stable
 */

/* ------------------------------------------------------------------ */
/* Raw parsed row                                                       */
/* ------------------------------------------------------------------ */

export interface CSVTransactionRow {
    rowNumber: number;
    rawLine: string;
    date: string;
    payee: string;
    amount: string;
    category: string;
    classification: string;
    note: string;
}

/* ------------------------------------------------------------------ */
/* Preview                                                             */
/* ------------------------------------------------------------------ */

export interface CSVPreviewResult {
    cancelled: boolean;
    error?: "FILE_TOO_LARGE" | "TOO_MANY_ROWS" | "FILE_READ_ERROR";
    previewRows: CSVTransactionRow[];
    totalDataRows: number;
    emptyLineCount: number;
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

export interface CSVRowError {
    rowNumber: number;
    rawLine: string;
    reason: string;
}

export interface CSVImportResult {
    successCount: number;
    emptyLineCount: number;
    failedRows: CSVRowError[];
}

export interface CSVImportRequest {
    accountId: number;
    positiveAreDeposits: boolean;
    dateFormat: string;
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export interface CSVExportRequest {
    accountId: number;
    positiveAreDeposits: boolean;
}

export interface CSVExportResult {
    cancelled: boolean;
    savedPath?: string;
}

/* ------------------------------------------------------------------ */
/* Template                                                            */
/* ------------------------------------------------------------------ */

export interface CSVTemplateResult {
    savedPath: string;
}

/* ------------------------------------------------------------------ */
/* Error export                                                        */
/* ------------------------------------------------------------------ */

export interface CSVExportErrorRowsResult {
    cancelled: boolean;
    savedPath?: string;
}
