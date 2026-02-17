/**
 * @module profileSessionService
 * @description Manages the active database connection for the currently opened user profile.
 * @stability stable
 */

import { SQLiteDatabase } from "../../database/databaseService";

/**
 * Manages the active database connection for the currently opened user profile.
 */
class ProfileSessionService {
    private activeDatabase: SQLiteDatabase | null = null;

    /**
     * Sets the active database connection for the current session.
     * @param db The SQLite database instance to set as active.
     */
    setDatabaseConnection(db: SQLiteDatabase): void {
        this.activeDatabase = db;
    }

    /**
     * Retrieves the active database connection for the current session.
     * @returns The active SQLite database instance, or null if no connection is active.
     */
    getDatabaseConnection(): SQLiteDatabase | null {
        return this.activeDatabase;
    }

    /**
     * Closes the active database connection and clears the session.
     */
    closeDatabaseConnection(): void {
        if (this.activeDatabase) {
            this.activeDatabase.close();
            this.activeDatabase = null;
        }
    }
}

export const profileSessionService = new ProfileSessionService();
