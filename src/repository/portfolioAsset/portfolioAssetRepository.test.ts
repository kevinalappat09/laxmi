import Database from "better-sqlite3";
import path from "path";
import { initializeSchema } from "../../database/databaseService";
import { MigrationService } from "../../services/migration/migrationService";
import { PortfolioAssetRepositoryImpl } from "./portfolioAssetRepository";

const migrationsDir = path.join(__dirname, "../../migrations");

function buildDb() {
    const db = new Database(":memory:");
    initializeSchema(db);
    new MigrationService(migrationsDir).migrate(db);
    return db;
}

describe("PortfolioAssetRepositoryImpl", () => {
    let db: ReturnType<typeof buildDb>;
    let repo: PortfolioAssetRepositoryImpl;

    beforeEach(() => {
        db = buildDb();
        repo = new PortfolioAssetRepositoryImpl(db);
    });

    afterEach(() => {
        db.close();
    });

    describe("create", () => {
        test("inserts a row and returns the full PortfolioAsset with correct field mapping", () => {
            const asset = repo.create({
                name: "Mirae Asset Large Cap Fund",
                category: "EQUITY",
                type: "EQUITY_MUTUAL_FUND",
                subCategory: "large_cap",
                priceSource: "MFAPI",
                priceSourceId: "119551",
                currency: "INR",
                metadata: { schemeCode: "119551", amc: "Mirae Asset" },
            });

            expect(asset.id).toBeGreaterThan(0);
            expect(asset.name).toBe("Mirae Asset Large Cap Fund");
            expect(asset.category).toBe("EQUITY");
            expect(asset.type).toBe("EQUITY_MUTUAL_FUND");
            expect(asset.subCategory).toBe("large_cap");
            expect(asset.priceSource).toBe("MFAPI");
            expect(asset.priceSourceId).toBe("119551");
            expect(asset.currency).toBe("INR");
            expect(asset.currentPrice).toBeNull();
            expect(asset.lastPriceUpdatedAt).toBeNull();
            expect(asset.isActive).toBe(true);
            expect(asset.createdOn).toBeTruthy();
            expect(asset.modifiedOn).toBeTruthy();
        });

        test("serializes metadata JSON correctly; getById deserializes it back", () => {
            const meta = { schemeCode: "119551", amc: "Mirae Asset" };
            const asset = repo.create({
                name: "Test Fund",
                category: "EQUITY",
                type: "EQUITY_MUTUAL_FUND",
                priceSource: "MFAPI",
                priceSourceId: "119551",
                metadata: meta,
            });

            const fetched = repo.getById(asset.id);
            expect(fetched?.metadata).toEqual(meta);
        });

        test("stores null metadata when not provided", () => {
            const asset = repo.create({
                name: "No Meta Fund",
                category: "DEBT",
                type: "LIQUID_FUND",
                priceSource: null,
                priceSourceId: null,
            });

            expect(asset.metadata).toBeNull();
        });
    });

    describe("listActive", () => {
        test("returns only rows where is_active = 1", () => {
            repo.create({ name: "Fund A", category: "EQUITY", type: "EQUITY_MUTUAL_FUND", priceSource: null, priceSourceId: null });
            repo.create({ name: "Fund B", category: "DEBT",   type: "LIQUID_FUND",        priceSource: null, priceSourceId: null });

            const active = repo.listActive();
            expect(active.length).toBe(2);
            expect(active.every((a) => a.isActive)).toBe(true);
        });

        test("excludes deactivated assets", () => {
            const a = repo.create({ name: "Active Fund",   category: "EQUITY", type: "EQUITY_MUTUAL_FUND", priceSource: null, priceSourceId: null });
            const b = repo.create({ name: "Inactive Fund", category: "EQUITY", type: "EQUITY_MUTUAL_FUND", priceSource: null, priceSourceId: null });
            repo.deactivate(b.id);

            const active = repo.listActive();
            expect(active.length).toBe(1);
            expect(active[0].id).toBe(a.id);
        });
    });

    describe("listByPriceSource", () => {
        test("returns only MFAPI assets", () => {
            repo.create({ name: "MF Fund",    category: "EQUITY", type: "EQUITY_MUTUAL_FUND", priceSource: "MFAPI",  priceSourceId: "111" });
            repo.create({ name: "Yahoo Fund", category: "EQUITY", type: "STOCK",              priceSource: "YAHOO",  priceSourceId: "TCS" });
            repo.create({ name: "No Source",  category: "DEBT",   type: "LIQUID_FUND",        priceSource: null,     priceSourceId: null });

            const mfapi = repo.listByPriceSource("MFAPI");
            expect(mfapi.length).toBe(1);
            expect(mfapi[0].priceSource).toBe("MFAPI");
        });
    });

    describe("updatePrice", () => {
        test("sets current_price and last_price_updated_at; modified_on is updated", () => {
            const asset = repo.create({ name: "Fund", category: "EQUITY", type: "EQUITY_MUTUAL_FUND", priceSource: "MFAPI", priceSourceId: "111" });

            const updatedAt = "2024-06-01T12:00:00.000Z";
            repo.updatePrice(asset.id, 123.45, updatedAt);

            const fetched = repo.getById(asset.id)!;
            expect(fetched.currentPrice).toBe(123.45);
            expect(fetched.lastPriceUpdatedAt).toBe(updatedAt);
            // modified_on is set by the repository to the current time
            expect(fetched.modifiedOn).toBeTruthy();
        });
    });

    describe("deactivate", () => {
        test("sets is_active = 0; getById still returns the row (soft delete)", () => {
            const asset = repo.create({ name: "Fund", category: "EQUITY", type: "EQUITY_MUTUAL_FUND", priceSource: null, priceSourceId: null });
            repo.deactivate(asset.id);

            const fetched = repo.getById(asset.id);
            expect(fetched).not.toBeNull();
            expect(fetched?.isActive).toBe(false);
        });
    });

    describe("update", () => {
        test("merges partial fields; unchanged fields are preserved", () => {
            const asset = repo.create({
                name: "Original Name",
                category: "EQUITY",
                type: "EQUITY_MUTUAL_FUND",
                subCategory: "large_cap",
                priceSource: "MFAPI",
                priceSourceId: "111",
            });

            const updated = repo.update(asset.id, { name: "New Name" });

            expect(updated.name).toBe("New Name");
            expect(updated.subCategory).toBe("large_cap");
            expect(updated.priceSource).toBe("MFAPI");
            expect(updated.priceSourceId).toBe("111");
        });

        test("throws when asset not found", () => {
            expect(() => repo.update(9999, { name: "X" })).toThrow("not found");
        });
    });
});
