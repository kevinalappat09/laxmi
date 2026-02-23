/**
 * @module databaseService
 * @description Handles SQLite connection lifecycle and core schema initialization.
 * @stability stable
 */

import Database from "better-sqlite3";

export type SQLiteDatabase = InstanceType<typeof Database>;

export function openDatabase(dbPath: string): SQLiteDatabase {
    const db = new Database(dbPath);

    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");

    return db;
}

export function closeDatabase(db: SQLiteDatabase): void {
    db.close();
}

export function initializeSchema(db: SQLiteDatabase): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS _schema (
          version INTEGER NOT NULL
        );
    `);

    const row = db.prepare(
        `SELECT version FROM _schema LIMIT 1`
    ).get() as { version: number } | undefined;

    if (!row) {
        db.prepare(
            `INSERT INTO _schema (version) VALUES (0)`
        ).run();
    }
}

export function getCurrentSchemaVersion(db: SQLiteDatabase): number {
    const row = db.prepare(
        `SELECT version FROM _schema LIMIT 1`
    ).get() as { version: number } | undefined;

    if (!row) {
        throw new Error("_schema table is not initialized.");
    }

    return row.version;
}

export function setSchemaVersion(
    db: SQLiteDatabase,
    version: number
): void {
    db.exec(`DELETE FROM _schema;`);
    db.prepare(
        `INSERT INTO _schema (version) VALUES (?)`
    ).run(version);
}