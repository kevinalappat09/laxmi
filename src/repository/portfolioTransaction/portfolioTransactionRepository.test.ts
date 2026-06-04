import Database from "better-sqlite3";
import path from "path";
import { initializeSchema } from "../../database/databaseService";
import { MigrationService } from "../../services/migration/migrationService";
import { PortfolioAssetRepositoryImpl } from "../portfolioAsset/portfolioAssetRepository";
import { PortfolioTransactionRepositoryImpl } from "./portfolioTransactionRepository";

const migrationsDir = path.join(__dirname, "../../migrations");

function buildDb() {
    const db = new Database(":memory:");
    initializeSchema(db);
    new MigrationService(migrationsDir).migrate(db);
    return db;
}

describe("PortfolioTransactionRepositoryImpl", () => {
    let db: ReturnType<typeof buildDb>;
    let assetRepo: PortfolioAssetRepositoryImpl;
    let repo: PortfolioTransactionRepositoryImpl;
    let assetId: number;
    let accountId: number;

    beforeEach(() => {
        db = buildDb();
        assetRepo = new PortfolioAssetRepositoryImpl(db);
        repo = new PortfolioTransactionRepositoryImpl(db);

        // Seed an investment account (Zerodha)
        const result = db.prepare(`
            INSERT INTO accounts (
                institution_name, account_name, account_type, sub_type,
                color, opened_on, created_on, modified_on, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run("Zerodha", "Main", "Asset", "investment",
               "#000000", "2022-01-01", "2022-01-01T00:00:00Z", "2022-01-01T00:00:00Z", 1);
        accountId = result.lastInsertRowid as number;

        // Seed a portfolio asset
        const asset = assetRepo.create({
            name: "Test Fund",
            category: "EQUITY",
            type: "EQUITY_MUTUAL_FUND",
            priceSource: "MFAPI",
            priceSourceId: "119551",
        });
        assetId = asset.id;
    });

    afterEach(() => {
        db.close();
    });

    function buy(quantity: number, pricePerUnit: number, date = "2024-01-15", fees = 0, taxes = 0) {
        return repo.create({
            portfolioAssetId: assetId,
            transactionType: "BUY",
            quantity,
            pricePerUnit,
            fees,
            taxes,
            transactionDate: new Date(date),
            assetAccountId: accountId,
        });
    }

    function sell(quantity: number, pricePerUnit: number, date = "2024-06-01") {
        return repo.create({
            portfolioAssetId: assetId,
            transactionType: "SELL",
            quantity,
            pricePerUnit,
            transactionDate: new Date(date),
            assetAccountId: accountId,
        });
    }

    describe("create", () => {
        test("persists quantity, price_per_unit, fees, taxes, transaction_date, asset_account_id correctly", () => {
            const txn = repo.create({
                portfolioAssetId: assetId,
                transactionType: "BUY",
                quantity: 50,
                pricePerUnit: 200,
                fees: 10,
                taxes: 2,
                transactionDate: new Date("2024-03-01"),
                assetAccountId: accountId,
            });

            expect(txn.id).toBeGreaterThan(0);
            expect(txn.quantity).toBe(50);
            expect(txn.pricePerUnit).toBe(200);
            expect(txn.fees).toBe(10);
            expect(txn.taxes).toBe(2);
            expect(txn.transactionDate).toBe("2024-03-01");
            expect(txn.assetAccountId).toBe(accountId);
            expect(txn.isActive).toBe(true);
        });

        test("persists source_account_id = null when not provided", () => {
            const txn = buy(10, 100);
            expect(txn.sourceAccountId).toBeNull();
        });
    });

    describe("getHoldings", () => {
        test("one BUY: total_units = quantity", () => {
            buy(100, 50);
            const holdings = repo.getHoldings();
            const h = holdings.find((r) => r.portfolioAssetId === assetId)!;
            expect(h.totalUnits).toBe(100);
        });

        test("two BUYs: total_units = sum of quantities", () => {
            buy(100, 50, "2024-01-01");
            buy(50, 60, "2024-02-01");
            const h = repo.getHoldings().find((r) => r.portfolioAssetId === assetId)!;
            expect(h.totalUnits).toBe(150);
        });

        test("BUY then partial SELL: total_units = buy_qty - sell_qty", () => {
            buy(100, 50);
            sell(30, 70);
            const h = repo.getHoldings().find((r) => r.portfolioAssetId === assetId)!;
            expect(h.totalUnits).toBe(70);
        });

        test("DIVIDEND with is_dividend_reinvestment = 1: units added to total_units", () => {
            buy(100, 50);
            repo.create({
                portfolioAssetId: assetId,
                transactionType: "DIVIDEND",
                quantity: 5,
                pricePerUnit: 55,
                isDividendReinvestment: true,
                transactionDate: new Date("2024-04-01"),
                assetAccountId: accountId,
            });
            const h = repo.getHoldings().find((r) => r.portfolioAssetId === assetId)!;
            expect(h.totalUnits).toBe(105);
        });
    });

    describe("getSummary", () => {
        beforeEach(() => {
            // Set a current_price so the view can compute current_value
            db.prepare(`UPDATE portfolio_assets SET current_price = 80 WHERE id = ?`).run(assetId);
        });

        test("AVCO = total_acquisition_cost / total_units_acquired", () => {
            // 100 units @ 50 = 5000; 50 units @ 70 = 3500 → total cost = 8500, units = 150 → AVCO = 56.666...
            buy(100, 50, "2024-01-01");
            buy(50, 70, "2024-02-01");

            const summary = repo.getSummary();
            const s = summary.find((r) => r.assetId === assetId)!;
            expect(s).toBeDefined();
            expect(s.avco).toBeCloseTo(8500 / 150, 5);
        });

        test("unrealized_pl = total_units * current_price - cost_basis", () => {
            buy(100, 50); // cost = 5000, AVCO = 50, cost_basis = 50 * 100 = 5000
            const s = repo.getSummary().find((r) => r.assetId === assetId)!;
            // current_price = 80, current_value = 100 * 80 = 8000
            expect(s.currentValue).toBe(8000);
            expect(s.unrealizedPl).toBeCloseTo(8000 - 5000, 5);
        });

        test("fully exited position (total_units = 0) is NOT returned", () => {
            buy(100, 50);
            sell(100, 80);
            const summary = repo.getSummary();
            const found = summary.find((r) => r.assetId === assetId);
            expect(found).toBeUndefined();
        });
    });

    describe("deactivate", () => {
        test("deactivated transaction is excluded from portfolio_holdings totals", () => {
            const txn = buy(100, 50);
            repo.deactivate(txn.id);
            const holdings = repo.getHoldings();
            const h = holdings.find((r) => r.portfolioAssetId === assetId);
            expect(h).toBeUndefined();
        });
    });

    describe("listByAsset", () => {
        test("returns transactions in descending date order", () => {
            buy(10, 50, "2024-01-01");
            buy(20, 60, "2024-03-01");
            buy(30, 70, "2024-02-01");

            const txns = repo.listByAsset(assetId);
            expect(txns[0].transactionDate).toBe("2024-03-01");
            expect(txns[1].transactionDate).toBe("2024-02-01");
            expect(txns[2].transactionDate).toBe("2024-01-01");
        });
    });

    describe("getTotalUnitsHeld", () => {
        test("returns 0 when no transactions exist for asset", () => {
            expect(repo.getTotalUnitsHeld(assetId)).toBe(0);
        });

        test("returns correct units after BUY + partial SELL", () => {
            buy(100, 50);
            sell(40, 70);
            expect(repo.getTotalUnitsHeld(assetId)).toBe(60);
        });
    });
});
