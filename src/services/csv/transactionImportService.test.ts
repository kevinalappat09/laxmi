/**
 * @module transactionImportService.test
 * @description Unit tests for TransactionImportServiceImpl — openAndPreview and confirmImport.
 * @stability stable
 */

jest.mock("electron", () => ({
    dialog: {
        showOpenDialog: jest.fn(),
    },
}));

jest.mock("fs");

jest.mock("../profileSession/profileSessionService");

jest.mock("../category/categoryService");

jest.mock("../../repository/transaction/transactionRepository");

import { TransactionImportServiceImpl } from "./transactionImportService";
import { dialog } from "electron";
import fs from "fs";
import { profileSessionService } from "../profileSession/profileSessionService";
import { CategoryServiceImpl } from "../category/categoryService";
import { TransactionRepositoryImpl } from "../../repository/transaction/transactionRepository";
import { TransactionType, Classification } from "../../types/transaction";

const mockDialog = dialog as jest.Mocked<typeof dialog>;
const mockFs = fs as jest.Mocked<typeof fs>;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeValidCsvContent(...rows: string[]): string {
    return rows.join("\n");
}

const VALID_ROW = "25-03-2026,Tesco,50.00,Food,needs,weekly shop";

const CATEGORY_ID = 42;
const ACCOUNT_ID = 1;

function makeMockDb(): any {
    return {
        transaction: (fn: () => void) => fn,
    };
}

/* ------------------------------------------------------------------ */
/* openAndPreview                                                      */
/* ------------------------------------------------------------------ */

describe("TransactionImportServiceImpl.openAndPreview", () => {
    let service: TransactionImportServiceImpl;

    beforeEach(() => {
        service = new TransactionImportServiceImpl();
    });

    test("returns cancelled=true when user dismisses the dialog", async () => {
        mockDialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

        const result = await service.openAndPreview();

        expect(result.cancelled).toBe(true);
        expect(result.previewRows).toHaveLength(0);
    });

    test("returns FILE_READ_ERROR when fs.statSync throws", async () => {
        mockDialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ["/some/file.csv"] });
        (mockFs.statSync as jest.Mock).mockImplementation(() => { throw new Error("no such file"); });

        const result = await service.openAndPreview();

        expect(result.error).toBe("FILE_READ_ERROR");
    });

    test("returns FILE_TOO_LARGE when the file exceeds MAX_CSV_FILE_BYTES", async () => {
        mockDialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ["/some/file.csv"] });
        (mockFs.statSync as jest.Mock).mockReturnValue({ size: 10 * 1024 * 1024 + 1 });

        const result = await service.openAndPreview();

        expect(result.error).toBe("FILE_TOO_LARGE");
    });

    test("returns FILE_READ_ERROR when fs.readFileSync throws", async () => {
        mockDialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ["/some/file.csv"] });
        (mockFs.statSync as jest.Mock).mockReturnValue({ size: 100 });
        (mockFs.readFileSync as jest.Mock).mockImplementation(() => { throw new Error("read error"); });

        const result = await service.openAndPreview();

        expect(result.error).toBe("FILE_READ_ERROR");
    });

    test("returns TOO_MANY_ROWS when the parsed CSV exceeds MAX_IMPORT_ROWS", async () => {
        mockDialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ["/some/file.csv"] });
        (mockFs.statSync as jest.Mock).mockReturnValue({ size: 100 });
        const rows = Array(10_001).fill(VALID_ROW).join("\n");
        (mockFs.readFileSync as jest.Mock).mockReturnValue(rows);

        const result = await service.openAndPreview();

        expect(result.error).toBe("TOO_MANY_ROWS");
    });

    test("returns preview rows (up to PREVIEW_ROW_COUNT=5) and totals for a valid file", async () => {
        mockDialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ["/some/file.csv"] });
        (mockFs.statSync as jest.Mock).mockReturnValue({ size: 100 });
        const csv = makeValidCsvContent(
            VALID_ROW, VALID_ROW, VALID_ROW,
            VALID_ROW, VALID_ROW, VALID_ROW,
        );
        (mockFs.readFileSync as jest.Mock).mockReturnValue(csv);

        const result = await service.openAndPreview();

        expect(result.cancelled).toBe(false);
        expect(result.error).toBeUndefined();
        expect(result.totalDataRows).toBe(6);
        expect(result.previewRows).toHaveLength(5);
    });

    test("returns totalDataRows equal to the number of non-empty lines", async () => {
        mockDialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ["/some/file.csv"] });
        (mockFs.statSync as jest.Mock).mockReturnValue({ size: 100 });
        (mockFs.readFileSync as jest.Mock).mockReturnValue(VALID_ROW);

        const result = await service.openAndPreview();

        expect(result.totalDataRows).toBe(1);
    });

    test("counts empty lines correctly", async () => {
        mockDialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ["/some/file.csv"] });
        (mockFs.statSync as jest.Mock).mockReturnValue({ size: 100 });
        const csv = `${VALID_ROW}\n\n${VALID_ROW}`;
        (mockFs.readFileSync as jest.Mock).mockReturnValue(csv);

        const result = await service.openAndPreview();

        expect(result.emptyLineCount).toBe(1);
        expect(result.totalDataRows).toBe(2);
    });
});

/* ------------------------------------------------------------------ */
/* confirmImport                                                       */
/* ------------------------------------------------------------------ */

describe("TransactionImportServiceImpl.confirmImport", () => {
    let service: TransactionImportServiceImpl;
    let mockSave: jest.Mock;

    beforeEach(() => {
        mockSave = jest.fn();
        (CategoryServiceImpl as jest.Mock).mockImplementation(() => ({
            getCategoryNameMap: () => new Map([["food", CATEGORY_ID]]),
        }));
        (TransactionRepositoryImpl as jest.Mock).mockImplementation(() => ({
            save: mockSave,
        }));
        (profileSessionService.getDatabaseConnection as jest.Mock).mockReturnValue(makeMockDb());
        service = new TransactionImportServiceImpl();
    });

    async function previewFile(csv: string): Promise<void> {
        mockDialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ["/file.csv"] });
        (mockFs.statSync as jest.Mock).mockReturnValue({ size: 100 });
        (mockFs.readFileSync as jest.Mock).mockReturnValue(csv);
        await service.openAndPreview();
    }

    test("throws if called without a prior openAndPreview", () => {
        expect(() =>
            service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" })
        ).toThrow("No CSV data pending");
    });

    test("throws if no active database connection", async () => {
        (profileSessionService.getDatabaseConnection as jest.Mock).mockReturnValue(null);

        await previewFile(VALID_ROW);

        expect(() =>
            service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" })
        ).toThrow("No active database connection");
    });

    test("imports a valid row and returns successCount=1 with no failures", async () => {
        await previewFile(VALID_ROW);

        const result = service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" });

        expect(result.successCount).toBe(1);
        expect(result.failedRows).toHaveLength(0);
        expect(mockSave).toHaveBeenCalledTimes(1);
    });

    test("positive amount with positiveAreDeposits=true is saved as Deposit", async () => {
        await previewFile("25-03-2026,Test,100.00,,needs,");

        service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" });

        expect(mockSave).toHaveBeenCalledWith(
            expect.objectContaining({ transaction_type: TransactionType.Deposit })
        );
    });

    test("negative amount with positiveAreDeposits=true is saved as Withdraw", async () => {
        await previewFile("25-03-2026,Test,-100.00,,needs,");

        service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" });

        expect(mockSave).toHaveBeenCalledWith(
            expect.objectContaining({ transaction_type: TransactionType.Withdraw })
        );
    });

    test("positive amount with positiveAreDeposits=false is saved as Withdraw", async () => {
        await previewFile("25-03-2026,Test,100.00,,needs,");

        service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: false, dateFormat: "DD-MM-YYYY" });

        expect(mockSave).toHaveBeenCalledWith(
            expect.objectContaining({ transaction_type: TransactionType.Withdraw })
        );
    });

    test("negative amount with positiveAreDeposits=false is saved as Deposit", async () => {
        await previewFile("25-03-2026,Test,-100.00,,needs,");

        service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: false, dateFormat: "DD-MM-YYYY" });

        expect(mockSave).toHaveBeenCalledWith(
            expect.objectContaining({ transaction_type: TransactionType.Deposit })
        );
    });

    test("amount is stored as absolute value regardless of sign", async () => {
        await previewFile("25-03-2026,Test,-250.75,,needs,");

        service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" });

        expect(mockSave).toHaveBeenCalledWith(
            expect.objectContaining({ amount: 250.75 })
        );
    });

    test("saves the correct transaction fields", async () => {
        await previewFile(VALID_ROW);

        service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" });

        expect(mockSave).toHaveBeenCalledWith(
            expect.objectContaining({
                account_id: ACCOUNT_ID,
                amount: 50,
                classification: Classification.Needs,
                payee: "Tesco",
                note: "weekly shop",
                category_id: CATEGORY_ID,
                is_active: true,
            })
        );
    });

    test("resolves category by case-insensitive name", async () => {
        await previewFile("25-03-2026,Test,50.00,FOOD,needs,");

        service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" });

        expect(mockSave).toHaveBeenCalledWith(
            expect.objectContaining({ category_id: CATEGORY_ID })
        );
    });

    test("allows a blank category field (no category_id assigned)", async () => {
        await previewFile("25-03-2026,Test,50.00,,needs,");

        service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" });

        expect(mockSave).toHaveBeenCalledWith(
            expect.objectContaining({ category_id: undefined })
        );
    });

    test("fails a row when the category name does not exist in the map", async () => {
        await previewFile("25-03-2026,Test,50.00,UnknownCategory,needs,");

        const result = service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" });

        expect(result.successCount).toBe(0);
        expect(result.failedRows).toHaveLength(1);
        expect(result.failedRows[0].reason).toContain("UnknownCategory");
        expect(mockSave).not.toHaveBeenCalled();
    });

    test("fails a row with an invalid date and continues to the next row", async () => {
        const csv = makeValidCsvContent(
            "bad-date,Test,50.00,,needs,",
            "25-03-2026,Test2,20.00,,wants,"
        );
        await previewFile(csv);

        const result = service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" });

        expect(result.successCount).toBe(1);
        expect(result.failedRows).toHaveLength(1);
        expect(result.failedRows[0].rowNumber).toBe(1);
        expect(mockSave).toHaveBeenCalledTimes(1);
    });

    test("fails a row with an invalid amount and records the reason", async () => {
        await previewFile("25-03-2026,Test,notanumber,,needs,");

        const result = service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" });

        expect(result.successCount).toBe(0);
        expect(result.failedRows[0].reason).toContain("Invalid amount");
    });

    test("fails a row with an invalid classification and records the reason", async () => {
        await previewFile("25-03-2026,Test,50.00,,luxury,");

        const result = service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" });

        expect(result.successCount).toBe(0);
        expect(result.failedRows[0].reason).toContain("Invalid classification");
    });

    test("imports multiple valid rows in a single call", async () => {
        const csv = makeValidCsvContent(
            "25-03-2026,Tesco,50.00,,needs,",
            "26-03-2026,Amazon,30.00,,wants,",
            "27-03-2026,Gym,15.00,,wants,"
        );
        await previewFile(csv);

        const result = service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" });

        expect(result.successCount).toBe(3);
        expect(result.failedRows).toHaveLength(0);
        expect(mockSave).toHaveBeenCalledTimes(3);
    });

    test("partial success: imports valid rows and skips invalid ones", async () => {
        const csv = makeValidCsvContent(
            "25-03-2026,Good,50.00,,needs,",
            "bad-date,Bad,50.00,,needs,",
            "26-03-2026,AlsoGood,20.00,,wants,"
        );
        await previewFile(csv);

        const result = service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" });

        expect(result.successCount).toBe(2);
        expect(result.failedRows).toHaveLength(1);
        expect(mockSave).toHaveBeenCalledTimes(2);
    });

    test("clears pending rows after import so a second confirmImport call throws", async () => {
        await previewFile(VALID_ROW);
        service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" });

        expect(() =>
            service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" })
        ).toThrow("No CSV data pending");
    });

    test("returns emptyLineCount from the original preview", async () => {
        const csv = `${VALID_ROW}\n\n${VALID_ROW}`;
        await previewFile(csv);

        const result = service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" });

        expect(result.emptyLineCount).toBe(1);
    });

    test("transaction_date is parsed as a UTC Date object", async () => {
        await previewFile("25-03-2026,Test,50.00,,needs,");

        service.confirmImport({ accountId: ACCOUNT_ID, positiveAreDeposits: true, dateFormat: "DD-MM-YYYY" });

        const savedTransaction = mockSave.mock.calls[0][0];
        expect(savedTransaction.transaction_date).toBeInstanceOf(Date);
        expect(savedTransaction.transaction_date.toISOString()).toBe("2026-03-25T00:00:00.000Z");
    });
});
