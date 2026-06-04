import Database from "better-sqlite3";
import path from "path";
import { initializeSchema } from "../../database/databaseService";
import { MigrationService } from "../../services/migration/migrationService";
import { PortfolioAssetRepositoryImpl } from "../portfolioAsset/portfolioAssetRepository";
import { PortfolioPriceRepositoryImpl } from "./portfolioPriceRepository";

const migrationsDir = path.join(__dirname, "../../migrations");

function buildDb() {
    const db = new Database(":memory:");
    initializeSchema(db);
    new MigrationService(migrationsDir).migrate(db);
    return db;
}

describe("PortfolioPriceRepositoryImpl", () => {
    let db: ReturnType<typeof buildDb>;
    let assetRepo: PortfolioAssetRepositoryImpl;
    let repo: PortfolioPriceRepositoryImpl;
    let assetId: number;

    beforeEach(() => {
        db = buildDb();
        assetRepo = new PortfolioAssetRepositoryImpl(db);
        repo = new PortfolioPriceRepositoryImpl(db);

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

    describe("upsertDailyPrice", () => {
        test("first call inserts a new row", () => {
            repo.upsertDailyPrice(assetId, 100.5, "INR", "2024-06-01");
            const count = (db.prepare(`SELECT COUNT(*) AS c FROM portfolio_price_history`).get() as any).c;
            expect(count).toBe(1);
        });

        test("second call same asset + same date replaces (row count stays at 1)", () => {
            repo.upsertDailyPrice(assetId, 100.5, "INR", "2024-06-01");
            repo.upsertDailyPrice(assetId, 105.0, "INR", "2024-06-01");
            const count = (db.prepare(`SELECT COUNT(*) AS c FROM portfolio_price_history`).get() as any).c;
            expect(count).toBe(1);
            const price = repo.getNavForDate(assetId, "2024-06-01");
            expect(price).toBe(105.0);
        });

        test("second call same asset + different date creates a second row", () => {
            repo.upsertDailyPrice(assetId, 100.5, "INR", "2024-06-01");
            repo.upsertDailyPrice(assetId, 102.0, "INR", "2024-06-02");
            const count = (db.prepare(`SELECT COUNT(*) AS c FROM portfolio_price_history`).get() as any).c;
            expect(count).toBe(2);
        });
    });

    describe("getHistoryByAsset", () => {
        beforeEach(() => {
            repo.upsertDailyPrice(assetId, 100, "INR", "2024-06-01");
            repo.upsertDailyPrice(assetId, 101, "INR", "2024-06-02");
            repo.upsertDailyPrice(assetId, 102, "INR", "2024-06-03");
            repo.upsertDailyPrice(assetId, 103, "INR", "2024-06-04");
        });

        test("returns rows filtered to the requested date range, ascending order", () => {
            const history = repo.getHistoryByAsset(assetId, "2024-06-02", "2024-06-03");
            expect(history.length).toBe(2);
            expect(history[0].recordedDate).toBe("2024-06-02");
            expect(history[1].recordedDate).toBe("2024-06-03");
        });
    });

    describe("getLatestBefore", () => {
        beforeEach(() => {
            repo.upsertDailyPrice(assetId, 100, "INR", "2024-06-01");
            repo.upsertDailyPrice(assetId, 101, "INR", "2024-06-02");
            repo.upsertDailyPrice(assetId, 102, "INR", "2024-06-03");
        });

        test("returns the price of the most recent record strictly before beforeDate", () => {
            const price = repo.getLatestBefore(assetId, "2024-06-03");
            expect(price).toBe(101);
        });

        test("returns null when no history exists for the asset", () => {
            const price = repo.getLatestBefore(9999, "2024-06-10");
            expect(price).toBeNull();
        });

        test("does not return a record on beforeDate itself (strict <)", () => {
            const price = repo.getLatestBefore(assetId, "2024-06-01");
            expect(price).toBeNull();
        });
    });

    describe("getNavForDate", () => {
        test("returns price when an exact date match exists", () => {
            repo.upsertDailyPrice(assetId, 99.5, "INR", "2024-05-15");
            expect(repo.getNavForDate(assetId, "2024-05-15")).toBe(99.5);
        });

        test("returns null when no record exists for that exact date", () => {
            expect(repo.getNavForDate(assetId, "2024-01-01")).toBeNull();
        });
    });
});
