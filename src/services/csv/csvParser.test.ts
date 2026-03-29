/**
 * @module csvParser.test
 * @description Unit tests for CSVParser — parse, validateRow, serialise, generateTemplate.
 * @stability stable
 */

import { CSVParser } from "./csvParser";
import { Classification, Transaction, TransactionType } from "../../types/transaction";
import { MAX_IMPORT_ROWS } from "./csvLimits";

describe("CSVParser", () => {
    let parser: CSVParser;

    beforeEach(() => {
        parser = new CSVParser();
    });

    /* ------------------------------------------------------------------ */
    /* parse                                                               */
    /* ------------------------------------------------------------------ */

    describe("parse", () => {
        test("parses a single data row into a CSVTransactionRow", () => {
            const raw = "25-03-2026,Tesco,50.00,Food,needs,weekly shop";
            const { rows, emptyLineCount, truncated } = parser.parse(raw);

            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                rowNumber: 1,
                rawLine: "25-03-2026,Tesco,50.00,Food,needs,weekly shop",
                date: "25-03-2026",
                payee: "Tesco",
                amount: "50.00",
                category: "Food",
                classification: "needs",
                note: "weekly shop",
            });
            expect(emptyLineCount).toBe(0);
            expect(truncated).toBe(false);
        });

        test("parses multiple rows and assigns correct rowNumbers", () => {
            const raw = "01-01-2026,Amazon,-20.00,Shopping,wants,\n02-01-2026,Salary,1000.00,,needs,";
            const { rows } = parser.parse(raw);

            expect(rows).toHaveLength(2);
            expect(rows[0].rowNumber).toBe(1);
            expect(rows[1].rowNumber).toBe(2);
        });

        test("skips blank lines and counts them as empty", () => {
            const raw = "01-01-2026,Test,10.00,,needs,\n\n03-01-2026,Test2,20.00,,wants,";
            const { rows, emptyLineCount } = parser.parse(raw);

            expect(rows).toHaveLength(2);
            expect(emptyLineCount).toBe(1);
        });

        test("skips lines that contain only commas (all empty fields)", () => {
            const raw = ",,,,,\n01-01-2026,Test,10.00,,needs,";
            const { rows, emptyLineCount } = parser.parse(raw);

            expect(rows).toHaveLength(1);
            expect(emptyLineCount).toBe(1);
        });

        test("handles CRLF line endings", () => {
            const raw = "01-01-2026,Test,10.00,,needs,\r\n02-01-2026,Test2,20.00,,wants,";
            const { rows } = parser.parse(raw);

            expect(rows).toHaveLength(2);
        });

        test("trims whitespace from individual fields", () => {
            const raw = " 25-03-2026 , Tesco , 50.00 , Food , needs , note ";
            const { rows } = parser.parse(raw);

            expect(rows[0].date).toBe("25-03-2026");
            expect(rows[0].payee).toBe("Tesco");
            expect(rows[0].amount).toBe("50.00");
            expect(rows[0].category).toBe("Food");
            expect(rows[0].classification).toBe("needs");
            expect(rows[0].note).toBe("note");
        });

        test("handles quoted fields containing commas", () => {
            const raw = `25-03-2026,"Smith, John",50.00,Food,needs,`;
            const { rows } = parser.parse(raw);

            expect(rows[0].payee).toBe("Smith, John");
        });

        test("handles escaped double-quotes inside quoted fields", () => {
            const raw = `25-03-2026,"He said ""hello""",50.00,Food,needs,`;
            const { rows } = parser.parse(raw);

            expect(rows[0].payee).toBe(`He said "hello"`);
        });

        test("handles missing trailing fields by defaulting them to empty string", () => {
            const raw = "25-03-2026,Tesco,50.00";
            const { rows } = parser.parse(raw);

            expect(rows[0].category).toBe("");
            expect(rows[0].classification).toBe("");
            expect(rows[0].note).toBe("");
        });

        test("sets truncated=true and stops when row count reaches MAX_IMPORT_ROWS", () => {
            const singleRow = "01-01-2026,Test,10.00,,needs,";
            const lines = Array(MAX_IMPORT_ROWS + 1).fill(singleRow).join("\n");
            const { rows, truncated } = parser.parse(lines);

            expect(truncated).toBe(true);
            expect(rows).toHaveLength(MAX_IMPORT_ROWS);
        });

        test("does not truncate when row count is exactly MAX_IMPORT_ROWS", () => {
            const singleRow = "01-01-2026,Test,10.00,,needs,";
            const lines = Array(MAX_IMPORT_ROWS).fill(singleRow).join("\n");
            const { rows, truncated } = parser.parse(lines);

            expect(truncated).toBe(false);
            expect(rows).toHaveLength(MAX_IMPORT_ROWS);
        });

        test("returns empty rows and zero counts for an empty string", () => {
            const { rows, emptyLineCount, truncated } = parser.parse("");

            expect(rows).toHaveLength(0);
            expect(emptyLineCount).toBe(1);
            expect(truncated).toBe(false);
        });
    });

    /* ------------------------------------------------------------------ */
    /* validateRow                                                         */
    /* ------------------------------------------------------------------ */

    describe("validateRow", () => {
        const baseRow = {
            rowNumber: 1,
            rawLine: "25-03-2026,Tesco,50.00,Food,needs,",
            date: "25-03-2026",
            payee: "Tesco",
            amount: "50.00",
            category: "Food",
            classification: "needs",
            note: "",
        };

        test("returns ok=true with parsed date, amount and classification for a valid row", () => {
            const result = parser.validateRow(baseRow, "DD-MM-YYYY");

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.date).toBeInstanceOf(Date);
                expect(result.date.toISOString()).toBe("2026-03-25T00:00:00.000Z");
                expect(result.amount).toBe(50.00);
                expect(result.classification).toBe(Classification.Needs);
            }
        });

        test("accepts a negative amount", () => {
            const row = { ...baseRow, amount: "-75.50" };
            const result = parser.validateRow(row, "DD-MM-YYYY");

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.amount).toBe(-75.50);
            }
        });

        test("accepts all valid classifications", () => {
            const classifications = ["needs", "wants", "unnecessary", "wasteful"];
            for (const c of classifications) {
                const row = { ...baseRow, classification: c };
                const result = parser.validateRow(row, "DD-MM-YYYY");
                expect(result.ok).toBe(true);
            }
        });

        test("returns ok=false for an invalid date format", () => {
            const row = { ...baseRow, date: "2026/03/25" };
            const result = parser.validateRow(row, "DD-MM-YYYY");

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain("Invalid date");
                expect(result.error).toContain("DD-MM-YYYY");
            }
        });

        test("returns ok=false for an empty date", () => {
            const row = { ...baseRow, date: "" };
            const result = parser.validateRow(row, "DD-MM-YYYY");

            expect(result.ok).toBe(false);
        });

        test("returns ok=false for a non-numeric amount", () => {
            const row = { ...baseRow, amount: "abc" };
            const result = parser.validateRow(row, "DD-MM-YYYY");

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain("Invalid amount");
            }
        });

        test("returns ok=false for a zero amount", () => {
            const row = { ...baseRow, amount: "0" };
            const result = parser.validateRow(row, "DD-MM-YYYY");

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain("Invalid amount");
            }
        });

        test("returns ok=false for an empty amount", () => {
            const row = { ...baseRow, amount: "" };
            const result = parser.validateRow(row, "DD-MM-YYYY");

            expect(result.ok).toBe(false);
        });

        test("returns ok=false for an invalid classification", () => {
            const row = { ...baseRow, classification: "luxury" };
            const result = parser.validateRow(row, "DD-MM-YYYY");

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain("Invalid classification");
                expect(result.error).toContain("luxury");
            }
        });

        test("returns ok=false for an empty classification", () => {
            const row = { ...baseRow, classification: "" };
            const result = parser.validateRow(row, "DD-MM-YYYY");

            expect(result.ok).toBe(false);
        });

        test("date parsing is case-sensitive for format string", () => {
            // Only "DD-MM-YYYY" is handled; any other string should return null date
            const row = { ...baseRow, date: "25-03-2026" };
            const result = parser.validateRow(row, "YYYY-MM-DD");

            expect(result.ok).toBe(false);
        });

        test("rejects a logically invalid date (e.g. month 13)", () => {
            const row = { ...baseRow, date: "01-13-2026" };
            const result = parser.validateRow(row, "DD-MM-YYYY");

            expect(result.ok).toBe(false);
        });
    });

    /* ------------------------------------------------------------------ */
    /* serialise                                                           */
    /* ------------------------------------------------------------------ */

    describe("serialise", () => {
        const now = new Date("2026-03-25T00:00:00.000Z");

        const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
            transaction_id: 1,
            account_id: 1,
            transaction_date: now,
            transaction_type: TransactionType.Withdraw,
            amount: 100,
            classification: Classification.Needs,
            payee: undefined,
            note: undefined,
            is_active: true,
            created_on: now,
            modified_on: now,
            ...overrides,
        });

        test("serialises a withdraw as a negative amount when positiveAreDeposits=true", () => {
            const tx = makeTransaction({ transaction_type: TransactionType.Withdraw, amount: 100 });
            const csv = parser.serialise([tx], true);

            expect(csv).toContain("-100");
        });

        test("serialises a deposit as a positive amount when positiveAreDeposits=true", () => {
            const tx = makeTransaction({ transaction_type: TransactionType.Deposit, amount: 200 });
            const csv = parser.serialise([tx], true);

            expect(csv).toContain("200");
            expect(csv).not.toContain("-200");
        });

        test("serialises a withdraw as a positive amount when positiveAreDeposits=false", () => {
            const tx = makeTransaction({ transaction_type: TransactionType.Withdraw, amount: 50 });
            const csv = parser.serialise([tx], false);

            expect(csv).toContain("50");
            expect(csv).not.toContain("-50");
        });

        test("serialises a deposit as a negative amount when positiveAreDeposits=false", () => {
            const tx = makeTransaction({ transaction_type: TransactionType.Deposit, amount: 300 });
            const csv = parser.serialise([tx], false);

            expect(csv).toContain("-300");
        });

        test("formats transaction_date as DD-MM-YYYY", () => {
            const tx = makeTransaction();
            const csv = parser.serialise([tx], true);

            expect(csv).toContain("25-03-2026");
        });

        test("escapes a payee containing a comma", () => {
            const tx = makeTransaction({ payee: "Smith, John" });
            const csv = parser.serialise([tx], true);

            expect(csv).toContain('"Smith, John"');
        });

        test("escapes a note containing double-quotes", () => {
            const tx = makeTransaction({ note: 'He said "hello"' });
            const csv = parser.serialise([tx], true);

            expect(csv).toContain('"He said ""hello"""');
        });

        test("outputs one line per transaction separated by newline", () => {
            const tx1 = makeTransaction({ amount: 10 });
            const tx2 = makeTransaction({ amount: 20 });
            const csv = parser.serialise([tx1, tx2], true);
            const lines = csv.split("\n");

            expect(lines).toHaveLength(2);
        });

        test("returns empty string for an empty transactions array", () => {
            const csv = parser.serialise([], true);

            expect(csv).toBe("");
        });

        test("includes the classification field in each row", () => {
            const tx = makeTransaction({ classification: Classification.Wasteful });
            const csv = parser.serialise([tx], true);

            expect(csv).toContain("wasteful");
        });
    });

    /* ------------------------------------------------------------------ */
    /* generateTemplate                                                    */
    /* ------------------------------------------------------------------ */

    describe("generateTemplate", () => {
        test("returns a single CSV row with six comma-separated fields", () => {
            const template = parser.generateTemplate();
            const fields = template.split(",");

            expect(fields).toHaveLength(6);
        });

        test("first field matches DD-MM-YYYY date format", () => {
            const template = parser.generateTemplate();
            const dateField = template.split(",")[0];

            expect(dateField).toMatch(/^\d{2}-\d{2}-\d{4}$/);
        });

        test("fifth field is a valid classification value", () => {
            const template = parser.generateTemplate();
            const classificationField = template.split(",")[4];
            const valid = ["needs", "wants", "unnecessary", "wasteful"];

            expect(valid).toContain(classificationField);
        });
    });
});
