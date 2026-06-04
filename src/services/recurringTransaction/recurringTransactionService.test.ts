jest.mock("../profileSession/profileSessionService");
jest.mock("../priceUpdater/providers/mfapiProvider");

import Database from "better-sqlite3";
import path from "path";
import { initializeSchema } from "../../database/databaseService";
import { MigrationService } from "../migration/migrationService";
import { profileSessionService } from "../profileSession/profileSessionService";
import { MfapiProviderImpl } from "../priceUpdater/providers/mfapiProvider";
import { RecurringTransactionServiceImpl } from "./recurringTransactionService";
import { RecurringFrequency } from "../../types/recurringTransaction";
import { Classification, TransactionType } from "../../types/transaction";

const migrationsDir = path.join(__dirname, "../../migrations");

function buildDb() {
    const db = new Database(":memory:");
    initializeSchema(db);
    new MigrationService(migrationsDir).migrate(db);
    return db;
}

function insertAccount(db: Database.Database, overrides: Record<string, any> = {}) {
    const result = db.prepare(`
        INSERT INTO accounts (institution_name, account_name, account_type, sub_type, color, opened_on, created_on, modified_on, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        overrides.institution_name ?? "Bank",
        overrides.account_name ?? "Savings",
        overrides.account_type ?? "Asset",
        overrides.sub_type ?? "savings",
        overrides.color ?? "#000",
        overrides.opened_on ?? "2022-01-01",
        "2022-01-01T00:00:00Z",
        "2022-01-01T00:00:00Z",
        1
    );
    return result.lastInsertRowid as number;
}

function insertPortfolioAsset(db: Database.Database, overrides: Record<string, any> = {}) {
    const result = db.prepare(`
        INSERT INTO portfolio_assets (name, category, type, price_source, price_source_id, currency, is_active, created_on, modified_on)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        overrides.name ?? "PPFAS Flexi Cap",
        overrides.category ?? "EQUITY",
        overrides.type ?? "EQUITY_MUTUAL_FUND",
        overrides.price_source ?? "MFAPI",
        overrides.price_source_id ?? "122639",
        overrides.currency ?? "INR",
        overrides.is_active ?? 1,
        "2022-01-01T00:00:00Z",
        "2022-01-01T00:00:00Z"
    );
    return result.lastInsertRowid as number;
}

describe("RecurringTransactionServiceImpl — Portfolio SIP", () => {
    let db: ReturnType<typeof buildDb>;
    let service: RecurringTransactionServiceImpl;
    let investmentAccountId: number;
    let bankAccountId: number;
    let assetId: number;
    let mockGetNavForDate: jest.Mock;

    beforeEach(() => {
        db = buildDb();
        (profileSessionService.getDatabaseConnection as jest.Mock).mockReturnValue(db);
        service = new RecurringTransactionServiceImpl();

        investmentAccountId = insertAccount(db, { account_name: "Zerodha", sub_type: "investment" });
        bankAccountId = insertAccount(db, { account_name: "HDFC Savings", sub_type: "savings" });
        assetId = insertPortfolioAsset(db);

        mockGetNavForDate = jest.fn().mockResolvedValue(100);
        (MfapiProviderImpl as jest.Mock).mockImplementation(() => ({
            getNavForDate: mockGetNavForDate,
        }));
    });

    afterEach(() => {
        db.close();
        jest.clearAllMocks();
    });

    // ── Validation tests ────────────────────────────────────────────────────

    describe("validateCreateRequest", () => {
        test("throws when portfolio_asset_id set but asset_account_id missing", () => {
            expect(() =>
                service.createRecurringTransaction({
                    transaction_type: TransactionType.Withdraw,
                    amount: 5000,
                    frequency: RecurringFrequency.Monthly,
                    day_of_month: 10,
                    start_date: new Date("2024-01-01"),
                    portfolio_asset_id: assetId,
                    // asset_account_id intentionally omitted
                })
            ).toThrow("asset_account_id is required when portfolio_asset_id is set.");
        });

        test("allows account_id = null when portfolio_asset_id is set", () => {
            const rec = service.createRecurringTransaction({
                account_id: null,
                transaction_type: TransactionType.Withdraw,
                amount: 5000,
                frequency: RecurringFrequency.Monthly,
                day_of_month: 10,
                start_date: new Date("2024-01-01"),
                portfolio_asset_id: assetId,
                asset_account_id: investmentAccountId,
            });
            expect(rec.recurring_id).toBeDefined();
            expect(rec.account_id).toBeNull();
        });

        test("throws when non-SIP and account_id is missing", () => {
            expect(() =>
                service.createRecurringTransaction({
                    transaction_type: TransactionType.Withdraw,
                    amount: 1000,
                    classification: Classification.Needs,
                    frequency: RecurringFrequency.Monthly,
                    day_of_month: 5,
                    start_date: new Date("2024-01-01"),
                })
            ).toThrow("account_id is required for non-portfolio recurring transactions.");
        });
    });

    // ── SIP processing ──────────────────────────────────────────────────────

    describe("processRecurringTransactions — SIP", () => {
        function createSipRecurring(sourceAccountId: number | null = bankAccountId) {
            return service.createRecurringTransaction({
                account_id: sourceAccountId,
                transaction_type: TransactionType.Withdraw,
                amount: 5000,
                frequency: RecurringFrequency.Monthly,
                day_of_month: 1,
                start_date: new Date("2024-01-01"),
                portfolio_asset_id: assetId,
                asset_account_id: investmentAccountId,
            });
        }

        test("SIP due today: creates portfolio_transactions row with type SIP", async () => {
            createSipRecurring();
            // referenceDate is 2024-01-02; processing cutoff is 2024-01-01
            await service.processRecurringTransactions(new Date("2024-01-02"));

            const rows = db.prepare("SELECT * FROM portfolio_transactions WHERE is_active = 1").all() as any[];
            expect(rows).toHaveLength(1);
            expect(rows[0].transaction_type).toBe("SIP");
        });

        test("SIP due today: quantity = amount / navForDate", async () => {
            mockGetNavForDate.mockResolvedValue(200);
            createSipRecurring();
            await service.processRecurringTransactions(new Date("2024-01-02"));

            const rows = db.prepare("SELECT * FROM portfolio_transactions").all() as any[];
            expect(rows[0].quantity).toBeCloseTo(25); // 5000 / 200
            expect(rows[0].price_per_unit).toBeCloseTo(200);
        });

        test("SIP: transaction_date is the due date (1st Jan), not processing date (2nd Jan)", async () => {
            createSipRecurring();
            await service.processRecurringTransactions(new Date("2024-01-02"));

            const rows = db.prepare("SELECT * FROM portfolio_transactions").all() as any[];
            expect(rows[0].transaction_date).toBe("2024-01-01");
        });

        test("SIP: creates bank withdraw transaction when account_id is set", async () => {
            createSipRecurring(bankAccountId);
            await service.processRecurringTransactions(new Date("2024-01-02"));

            const txns = db.prepare(
                "SELECT * FROM transactions WHERE account_id = ? AND transaction_type = 'withdraw'"
            ).all(bankAccountId) as any[];
            expect(txns).toHaveLength(1);
            expect(txns[0].amount).toBe(5000);
            expect(txns[0].transaction_date).toBe("2024-01-01");
        });

        test("SIP with account_id = null: no bank transaction created", async () => {
            createSipRecurring(null);
            await service.processRecurringTransactions(new Date("2024-01-02"));

            const ptRows = db.prepare("SELECT * FROM portfolio_transactions").all() as any[];
            expect(ptRows).toHaveLength(1);

            const txnRows = db.prepare("SELECT * FROM transactions").all() as any[];
            expect(txnRows).toHaveLength(0);
        });

        test("SIP: last_processed_date advanced to dueDate after success", async () => {
            const rec = createSipRecurring();
            await service.processRecurringTransactions(new Date("2024-01-02"));

            const row = db.prepare(
                "SELECT last_processed_date FROM recurring_transactions WHERE recurring_id = ?"
            ).get(rec.recurring_id) as any;
            expect(row.last_processed_date).toBe("2024-01-01");
        });

        test("SIP: asset_account_id is set correctly on portfolio transaction", async () => {
            createSipRecurring();
            await service.processRecurringTransactions(new Date("2024-01-02"));

            const rows = db.prepare("SELECT * FROM portfolio_transactions").all() as any[];
            expect(rows[0].asset_account_id).toBe(investmentAccountId);
        });

        test("SIP: linked_recurring_id is set on portfolio transaction", async () => {
            const rec = createSipRecurring();
            await service.processRecurringTransactions(new Date("2024-01-02"));

            const rows = db.prepare("SELECT * FROM portfolio_transactions").all() as any[];
            expect(rows[0].linked_recurring_id).toBe(rec.recurring_id);
        });

        // ── NAV lookup ────────────────────────────────────────────────────

        test("SIP: uses price_history when NAV already cached (MFAPI not called)", async () => {
            createSipRecurring();
            // Pre-seed NAV for the due date
            db.prepare(`
                INSERT INTO portfolio_price_history (portfolio_asset_id, price, currency, recorded_date, created_on)
                VALUES (?, ?, ?, ?, ?)
            `).run(assetId, 150, "INR", "2024-01-01", new Date().toISOString());

            await service.processRecurringTransactions(new Date("2024-01-02"));

            expect(mockGetNavForDate).not.toHaveBeenCalled();
            const rows = db.prepare("SELECT * FROM portfolio_transactions").all() as any[];
            expect(rows[0].price_per_unit).toBeCloseTo(150);
        });

        test("SIP: calls MFAPI getNavForDate when no cached price exists", async () => {
            mockGetNavForDate.mockResolvedValue(123.45);
            createSipRecurring();
            await service.processRecurringTransactions(new Date("2024-01-02"));

            expect(mockGetNavForDate).toHaveBeenCalledWith("122639", "2024-01-01");
        });

        test("SIP: stores fetched NAV in portfolio_price_history after MFAPI lookup", async () => {
            mockGetNavForDate.mockResolvedValue(99);
            createSipRecurring();
            await service.processRecurringTransactions(new Date("2024-01-02"));

            const row = db.prepare(
                "SELECT * FROM portfolio_price_history WHERE portfolio_asset_id = ? AND recorded_date = ?"
            ).get(assetId, "2024-01-01") as any;
            expect(row).not.toBeNull();
            expect(row.price).toBeCloseTo(99);
        });

        // ── Opened late ───────────────────────────────────────────────────

        test("SIP opened 3 days late: transaction_date is the 1st (due date), not the 4th", async () => {
            createSipRecurring();
            // App opened on 4th Jan — 3 days late
            await service.processRecurringTransactions(new Date("2024-01-04"));

            const rows = db.prepare("SELECT * FROM portfolio_transactions").all() as any[];
            expect(rows[0].transaction_date).toBe("2024-01-01");
        });

        // ── Error handling ────────────────────────────────────────────────

        test("MFAPI network failure: SIP skipped, last_processed_date NOT advanced", async () => {
            mockGetNavForDate.mockRejectedValue(new Error("Network error"));
            const rec = createSipRecurring();
            const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

            await service.processRecurringTransactions(new Date("2024-01-02"));

            const row = db.prepare(
                "SELECT last_processed_date FROM recurring_transactions WHERE recurring_id = ?"
            ).get(rec.recurring_id) as any;
            expect(row.last_processed_date).toBeNull();

            const ptRows = db.prepare("SELECT * FROM portfolio_transactions").all() as any[];
            expect(ptRows).toHaveLength(0);

            consoleSpy.mockRestore();
        });

        test("MFAPI network failure: other SIPs still processed", async () => {
            const assetId2 = insertPortfolioAsset(db, { name: "HDFC Top 100", price_source_id: "111222" });
            // First SIP will fail, second will succeed
            createSipRecurring();
            service.createRecurringTransaction({
                account_id: null,
                transaction_type: TransactionType.Withdraw,
                amount: 3000,
                frequency: RecurringFrequency.Monthly,
                day_of_month: 1,
                start_date: new Date("2024-01-01"),
                portfolio_asset_id: assetId2,
                asset_account_id: investmentAccountId,
            });

            mockGetNavForDate
                .mockRejectedValueOnce(new Error("Network error"))
                .mockResolvedValueOnce(50);

            const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
            const count = await service.processRecurringTransactions(new Date("2024-01-02"));

            // Only one SIP succeeded
            expect(count).toBe(1);
            consoleSpy.mockRestore();
        });

        // ── Atomicity ─────────────────────────────────────────────────────

        test("atomicity: if bank withdraw fails, portfolio transaction is rolled back", async () => {
            createSipRecurring(bankAccountId);

            // Drop transactions table so the bank debit INSERT throws a DB error,
            // which causes db.transaction() to roll back the portfolio INSERT too.
            db.exec("DROP TABLE transactions");

            const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
            await service.processRecurringTransactions(new Date("2024-01-02"));
            consoleSpy.mockRestore();

            const ptRows = db.prepare("SELECT * FROM portfolio_transactions").all() as any[];
            expect(ptRows).toHaveLength(0);
        });

        // ── No duplicate processing ────────────────────────────────────────

        test("SIP not processed again once last_processed_date is advanced", async () => {
            createSipRecurring();
            await service.processRecurringTransactions(new Date("2024-01-02"));
            // Process again on next day — should NOT create another transaction
            await service.processRecurringTransactions(new Date("2024-01-03"));

            const rows = db.prepare("SELECT * FROM portfolio_transactions").all() as any[];
            expect(rows).toHaveLength(1);
        });
    });

    // ── Regular recurring transactions unaffected ────────────────────────────

    describe("processRecurringTransactions — regular (non-SIP)", () => {
        test("regular recurring: behaviour completely unchanged", async () => {
            service.createRecurringTransaction({
                account_id: bankAccountId,
                transaction_type: TransactionType.Withdraw,
                amount: 1000,
                classification: Classification.Needs,
                payee: "Rent",
                frequency: RecurringFrequency.Monthly,
                day_of_month: 1,
                start_date: new Date("2024-01-01"),
            });

            const count = await service.processRecurringTransactions(new Date("2024-01-02"));

            expect(count).toBe(1);
            const txns = db.prepare("SELECT * FROM transactions").all() as any[];
            expect(txns).toHaveLength(1);
            expect(txns[0].amount).toBe(1000);
            expect(txns[0].transaction_date).toBe("2024-01-01");

            // No portfolio transactions created
            const ptRows = db.prepare("SELECT * FROM portfolio_transactions").all() as any[];
            expect(ptRows).toHaveLength(0);

            // MFAPI not called
            expect(mockGetNavForDate).not.toHaveBeenCalled();
        });
    });
});
