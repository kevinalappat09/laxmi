import path from "path";
import fs from "fs";
import {
    getCurrentSchemaVersion,
    setSchemaVersion,
    SQLiteDatabase,
} from "../../database/databaseService";

interface Migration {
    version: number;
    up: (db: SQLiteDatabase) => void;
}

export class MigrationService {
    constructor(private migrationsDir: string) { }

    protected loadMigrations(): Migration[] {
        if (!fs.existsSync(this.migrationsDir)) {
            return [];
        }

        const files = fs
            .readdirSync(this.migrationsDir)
            .filter((f) => f.endsWith(".js") || f.endsWith(".ts"))
            .sort((a, b) => {
                const aVersion = parseInt(a.match(/^(\d+)-/)?.[1] ?? "0", 10);
                const bVersion = parseInt(b.match(/^(\d+)-/)?.[1] ?? "0", 10);
                return aVersion - bVersion;
            });

        return files.map((file) => {
            const match = file.match(/^(\d+)-/);
            if (!match) {
                throw new Error(
                    `Invalid migration filename format: ${file}`
                );
            }

            const version = parseInt(match[1], 10);
            const migrationModule = require(path.join(this.migrationsDir, file));

            if (!migrationModule.up || typeof migrationModule.up !== "function") {
                throw new Error(
                    `Migration ${file} must export an 'up(db)' function`
                );
            }

            return {
                version,
                up: migrationModule.up,
            };
        });
    }

    private applyMigration(db: SQLiteDatabase, migration: Migration): void {
        const transaction = db.transaction(() => {
            migration.up(db);
            setSchemaVersion(db, migration.version);
        });

        transaction();
    }

    public migrate(db: SQLiteDatabase): void {
        const migrations = this.loadMigrations();
        const currentVersion = getCurrentSchemaVersion(db);

        const pendingMigrations = migrations.filter(
            (m) => m.version > currentVersion
        );

        for (const migration of pendingMigrations) {
            this.applyMigration(db, migration);
        }
    }
}
