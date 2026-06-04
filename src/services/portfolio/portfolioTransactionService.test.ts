jest.mock("../profileSession/profileSessionService");

import Database from "better-sqlite3";
import path from "path";
import { initializeSchema } from "../../database/databaseService";
import { MigrationService } from "../migration/migrationService";
import { profileSessionService } from "../profileSession/profileSessionService";
import { PortfolioTransactionServiceImpl } from "./portfolioTransactionService";

const migrationsDir = path.join(__dirname, "../../migrations");

function buildDb() {
    const db = new Database(":memory:");
    initializeSchema(db);
    new MigrationService(migrationsDir).migrate(db);
    return db;
}

describe("PortfolioTransactionServiceImpl", () => {
    let db: ReturnType<typeof buildDb>;
    let service: PortfolioTransactionServiceImpl;
    let assetId: number;
    let investmentAccountId: number;
    let bankAccountId: number;

    beforeEach(() => {
        db = buildDb();
        (profileSessionService.getDatabaseConnection as jest.Mock).mockReturnValue(db);
        service = new PortfolioTransactionServiceImpl();

        // Create an investment account (Zerodha)
        const invResult = db.prepare(`
            INSERT INTO accounts (institution_name, account_name, account_type, sub_type, color, opened_on, created_on, modified_on, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run("Zerodha", "Portfolio", "Asset", "investment", "#000", "2022-01-01", "2022-01-01T00:00:00Z", "2022-01-01T00:00:00Z", 1);
        investmentAccountId = invResult.lastInsertRowid as number;

        // Create a bank account (HDFC Savings)
        const bankResult = db.prepare(`
            INSERT INTO accounts (institution_name, account_name, account_type, sub_type, color, opened_on, created_on, modified_on, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run("HDFC", "Savings", "Asset", "savings", "#000", "2022-01-01", "2022-01-01T00:00:00Z", "2022-01-01T00:00:00Z", 1);
        bankAccountId = bankResult.lastInsertRowid as number;

        // Create a portfolio asset
        const assetResult = db.prepare(`
            INSERT INTO portfolio_assets (name, category, type, price_source, price_source_id, currency, is_active, created_on, modified_on)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run("Test Fund", "EQUITY", "EQUITY_MUTUAL_FUND", "MFAPI", "111", "INR", 1, "2022-01-01T00:00:00Z", "2022-01-01T00:00:00Z");
        assetId = assetResult.lastInsertRowid as number;
    });

    afterEach(() => {
        db.close();
    });

    function baseBuy(overrides = {}) {
        return {
            portfolioAssetId: assetId,
            transactionType: 'BUY' as const,
            pricePerUnit: 50,
            transactionDate: new Date("2024-01-15"),
            assetAccountId: investmentAccountId,
            ...overrides,
        };
    }

    describe("quantity resolution", () => {
        test("BUY with investedAmount=5000, pricePerUnit=50 → stored quantity=100", () => {
            const txn = service.create(baseBuy({ investedAmount: 5000, pricePerUnit: 50 }));
            expect(txn.quantity).toBeCloseTo(100);
        });

        test("BUY with quantity=10, pricePerUnit=50 → stored quantity=10", () => {
            const txn = service.create(baseBuy({ quantity: 10 }));
            expect(txn.quantity).toBe(10);
        });

        test("throws when both quantity and investedAmount are provided", () => {
            expect(() =>
                service.create(baseBuy({ quantity: 10, investedAmount: 500 }))
            ).toThrow("not both");
        });

        test("throws when neither quantity nor investedAmount is provided", () => {
            expect(() => service.create(baseBuy())).toThrow("must be provided");
        });
    });

    describe("bank account transactions", () => {
        test("BUY with sourceAccountId: both portfolio_transaction and a Laxmi withdraw are created", () => {
            service.create(baseBuy({ quantity: 100, sourceAccountId: bankAccountId }));

            const ptxns = db.prepare(`SELECT * FROM portfolio_transactions`).all() as any[];
            const laxmiTxns = db.prepare(`SELECT * FROM transactions`).all() as any[];

            expect(ptxns).toHaveLength(1);
            expect(laxmiTxns).toHaveLength(1);
            expect(laxmiTxns[0].transaction_type).toBe("withdraw");
            expect(laxmiTxns[0].amount).toBeCloseTo(100 * 50);
        });

        test("BUY with sourceAccountId: if Laxmi transaction throws, portfolio transaction is rolled back", () => {
            // Drop the transactions table to force the Laxmi insert to fail
            db.exec(`DROP TABLE transactions`);

            expect(() =>
                service.create(baseBuy({ quantity: 10, sourceAccountId: bankAccountId }))
            ).toThrow();

            // portfolio_transaction should NOT have been committed
            const ptxns = db.prepare(`SELECT * FROM portfolio_transactions`).all() as any[];
            expect(ptxns).toHaveLength(0);
        });

        test("BUY with sourceAccountId=null: only portfolio_transaction created; no Laxmi transaction", () => {
            service.create(baseBuy({ quantity: 10, sourceAccountId: null }));

            const ptxns = db.prepare(`SELECT * FROM portfolio_transactions`).all() as any[];
            const laxmiTxns = db.prepare(`SELECT * FROM transactions`).all() as any[];

            expect(ptxns).toHaveLength(1);
            expect(laxmiTxns).toHaveLength(0);
        });

        test("SELL with sourceAccountId: creates a deposit (not withdraw) on the Laxmi account", () => {
            // First buy 100 units
            service.create(baseBuy({ quantity: 100 }));
            // Then sell 50
            service.create({
                portfolioAssetId: assetId,
                transactionType: "SELL",
                quantity: 50,
                pricePerUnit: 70,
                transactionDate: new Date("2024-06-01"),
                assetAccountId: investmentAccountId,
                sourceAccountId: bankAccountId,
            });

            const laxmiTxns = db.prepare(`SELECT * FROM transactions`).all() as any[];
            expect(laxmiTxns).toHaveLength(1);
            expect(laxmiTxns[0].transaction_type).toBe("deposit");
        });

        test("DIVIDEND cash with sourceAccountId: creates deposit on Laxmi account", () => {
            service.create({
                portfolioAssetId: assetId,
                transactionType: "DIVIDEND",
                quantity: 10,
                pricePerUnit: 5,
                isDividendReinvestment: false,
                transactionDate: new Date("2024-04-01"),
                assetAccountId: investmentAccountId,
                sourceAccountId: bankAccountId,
            });

            const laxmiTxns = db.prepare(`SELECT * FROM transactions`).all() as any[];
            expect(laxmiTxns).toHaveLength(1);
            expect(laxmiTxns[0].transaction_type).toBe("deposit");
        });

        test("DIVIDEND reinvestment: no Laxmi transaction created", () => {
            service.create({
                portfolioAssetId: assetId,
                transactionType: "DIVIDEND",
                quantity: 5,
                pricePerUnit: 55,
                isDividendReinvestment: true,
                transactionDate: new Date("2024-04-01"),
                assetAccountId: investmentAccountId,
                sourceAccountId: bankAccountId,
            });

            const laxmiTxns = db.prepare(`SELECT * FROM transactions`).all() as any[];
            expect(laxmiTxns).toHaveLength(0);
        });
    });

    describe("oversell guard", () => {
        beforeEach(() => {
            service.create(baseBuy({ quantity: 100 }));
        });

        test("SELL throws when quantity > getTotalUnitsHeld", () => {
            expect(() =>
                service.create({
                    portfolioAssetId: assetId,
                    transactionType: "SELL",
                    quantity: 101,
                    pricePerUnit: 70,
                    transactionDate: new Date("2024-06-01"),
                    assetAccountId: investmentAccountId,
                })
            ).toThrow("Cannot sell more units than currently held");
        });

        test("SELL succeeds when quantity = getTotalUnitsHeld (exact sell-all)", () => {
            const txn = service.create({
                portfolioAssetId: assetId,
                transactionType: "SELL",
                quantity: 100,
                pricePerUnit: 70,
                transactionDate: new Date("2024-06-01"),
                assetAccountId: investmentAccountId,
            });
            expect(txn.quantity).toBe(100);
        });
    });

    describe("validation", () => {
        test("throws when portfolioAssetId refers to a non-existent asset", () => {
            expect(() =>
                service.create({ ...baseBuy({ quantity: 10 }), portfolioAssetId: 9999 })
            ).toThrow("Portfolio asset not found");
        });

        test("throws when portfolioAssetId refers to an inactive asset", () => {
            db.prepare(`UPDATE portfolio_assets SET is_active = 0 WHERE id = ?`).run(assetId);
            expect(() =>
                service.create(baseBuy({ quantity: 10 }))
            ).toThrow("inactive");
        });

        test("throws when assetAccountId refers to a non-investment account", () => {
            expect(() =>
                service.create({ ...baseBuy({ quantity: 10 }), assetAccountId: bankAccountId })
            ).toThrow("not an investment account");
        });

        test("throws when sourceAccountId refers to a non-existent Laxmi account", () => {
            expect(() =>
                service.create(baseBuy({ quantity: 10, sourceAccountId: 9999 }))
            ).toThrow("Source account not found");
        });
    });
});
