import Database from "better-sqlite3";
import { getCurrentSchemaVersion, initializeSchema, setSchemaVersion } from "./databaseService";


describe("database service", () => {
    let db: Database.Database;

    beforeEach(() => {
        db = new Database(":memory:");
    });
    afterEach(() => {
        db.close();
    });

    it("initializes schema to 0", () => {
        initializeSchema(db);
        const version = getCurrentSchemaVersion(db);
        expect(version).toBe(0);
    });

    it("sets new schema version correctly", () => {
        initializeSchema(db);
        setSchemaVersion(db, 3);
        const version = getCurrentSchemaVersion(db);
        expect(version).toBe(3);
    });

    it("does not overwrite existing schema version", () => {
        initializeSchema(db);
        setSchemaVersion(db, 3);
        initializeSchema(db);
        const version = getCurrentSchemaVersion(db);
        expect(version).toBe(3);
    });

    it("throws error if _schema table not initalized", () => {
        expect(() => {
            getCurrentSchemaVersion(db);
        }).toThrow();
    });
});