import { MigrationService } from "./migrationService";
import {
    getCurrentSchemaVersion,
    setSchemaVersion,
} from "../../database/databaseService";

jest.mock("../../database/databaseService");

describe("MigrationService (unit tests)", () => {
    let db: any;
    let migrationService: MigrationService;

    beforeEach(() => {
        db = {
            transaction: jest.fn((fn) => fn),
        };

        (getCurrentSchemaVersion as jest.Mock).mockReturnValue(0);

        migrationService = new MigrationService("/fake");

        jest.spyOn(migrationService as any, "loadMigrations").mockReturnValue([
            { version: 1, up: jest.fn() },
            { version: 2, up: jest.fn() },
        ]);
    });

    it("applies only pending migrations", () => {
        migrationService.migrate(db);

        const migrations =
            (migrationService as any).loadMigrations.mock.results[0].value;

        expect(migrations[0].up).toHaveBeenCalledWith(db);
        expect(migrations[1].up).toHaveBeenCalledWith(db);

        expect(setSchemaVersion).toHaveBeenCalledWith(db, 1);
        expect(setSchemaVersion).toHaveBeenCalledWith(db, 2);
    });
});
