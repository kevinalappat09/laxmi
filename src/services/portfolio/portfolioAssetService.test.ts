jest.mock("../profileSession/profileSessionService");

import Database from "better-sqlite3";
import path from "path";
import { initializeSchema } from "../../database/databaseService";
import { MigrationService } from "../migration/migrationService";
import { profileSessionService } from "../profileSession/profileSessionService";
import { PortfolioAssetServiceImpl } from "./portfolioAssetService";

const migrationsDir = path.join(__dirname, "../../migrations");

function buildDb() {
    const db = new Database(":memory:");
    initializeSchema(db);
    new MigrationService(migrationsDir).migrate(db);
    return db;
}

describe("PortfolioAssetServiceImpl", () => {
    let db: ReturnType<typeof buildDb>;
    let service: PortfolioAssetServiceImpl;

    beforeEach(() => {
        db = buildDb();
        (profileSessionService.getDatabaseConnection as jest.Mock).mockReturnValue(db);
        service = new PortfolioAssetServiceImpl();
    });

    afterEach(() => {
        db.close();
    });

    describe("create", () => {
        test("creates EQUITY_MUTUAL_FUND with valid MFAPI metadata → returns PortfolioAsset", () => {
            const asset = service.create({
                name: "Parag Parikh Flexi Cap",
                category: "EQUITY",
                type: "EQUITY_MUTUAL_FUND",
                priceSource: "MFAPI",
                priceSourceId: "122639",
                metadata: { schemeCode: "122639", schemeName: "Parag Parikh Flexi Cap Fund" },
            });

            expect(asset.id).toBeGreaterThan(0);
            expect(asset.name).toBe("Parag Parikh Flexi Cap");
            expect(asset.type).toBe("EQUITY_MUTUAL_FUND");
            expect(asset.priceSource).toBe("MFAPI");
            expect(asset.isActive).toBe(true);
        });

        test("creates LIQUID_FUND with valid MFAPI metadata → success", () => {
            const asset = service.create({
                name: "HDFC Liquid Fund",
                category: "DEBT",
                type: "LIQUID_FUND",
                priceSource: "MFAPI",
                priceSourceId: "100033",
                metadata: { schemeCode: "100033", schemeName: "HDFC Liquid Fund" },
            });

            expect(asset.type).toBe("LIQUID_FUND");
            expect(asset.isActive).toBe(true);
        });

        test("rejects EQUITY_MUTUAL_FUND with priceSource = YAHOO → throws", () => {
            expect(() =>
                service.create({
                    name: "Bad Fund",
                    category: "EQUITY",
                    type: "EQUITY_MUTUAL_FUND",
                    priceSource: "YAHOO",
                    priceSourceId: "test",
                    metadata: { schemeCode: "111" },
                })
            ).toThrow("Invalid price source for mutual fund");
        });

        test("rejects MFAPI asset where metadata.schemeCode is absent → throws", () => {
            expect(() =>
                service.create({
                    name: "Bad Fund",
                    category: "EQUITY",
                    type: "EQUITY_MUTUAL_FUND",
                    priceSource: "MFAPI",
                    priceSourceId: "111",
                })
            ).toThrow("Missing MFAPI scheme code");
        });

        test("throws when no active DB connection", () => {
            (profileSessionService.getDatabaseConnection as jest.Mock).mockReturnValue(null);
            expect(() =>
                service.create({
                    name: "Fund",
                    category: "EQUITY",
                    type: "EQUITY_MUTUAL_FUND",
                    priceSource: "MFAPI",
                    priceSourceId: "111",
                    metadata: { schemeCode: "111" },
                })
            ).toThrow("No active database connection");
        });
    });

    describe("deactivate", () => {
        test("marks asset inactive; listActive no longer returns it", () => {
            const asset = service.create({
                name: "Fund",
                category: "EQUITY",
                type: "EQUITY_MUTUAL_FUND",
                priceSource: "MFAPI",
                priceSourceId: "111",
                metadata: { schemeCode: "111" },
            });

            service.deactivate(asset.id);

            const active = service.listActive();
            expect(active.find((a) => a.id === asset.id)).toBeUndefined();
        });

        test("deactivate throws when asset ID not found", () => {
            expect(() => service.deactivate(9999)).toThrow("Asset not found");
        });
    });
});
