/**
 * @module accountRepository
 * @description Provides direct database access for Account entities.
 * @stability stable
 */

import { SQLiteDatabase } from "../../database/databaseService";
import { Account, AccountType } from "../../types/account";

/**
 * Repository interface for Account persistence.
 */
export interface AccountRepository {
    save(account: Account): Account;
    findById(accountId: number): Account | null;
    findAllActive(): Account[];
    findByType(type: AccountType): Account[];
    deactivate(accountId: number): void;
}

/**
 * Account repository implementation.
 */
export class AccountRepositoryImpl implements AccountRepository {
    constructor(private db: SQLiteDatabase) {}

    /**
     * Saves a new account or updates an existing one.
     */
    save(account: Account): Account {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const {
            account_id,
            institution_name,
            account_name,
            account_type,
            sub_type,
            color,
            opened_on,
            created_on,
            modified_on,
            is_active,
        } = account;

        const openedOnStr = this.dateToISOString(opened_on, "date");
        const createdOnStr = this.dateToISOString(created_on, "timestamp");
        const modifiedOnStr = this.dateToISOString(modified_on, "timestamp");

        if (account_id) {
            // Update existing
            const stmt = this.db.prepare(`
                UPDATE accounts
                SET institution_name = ?,
                    account_name = ?,
                    account_type = ?,
                    sub_type = ?,
                    color = ?,
                    opened_on = ?,
                    modified_on = ?,
                    is_active = ?
                WHERE account_id = ?
            `);

            stmt.run(
                institution_name,
                account_name,
                account_type,
                sub_type,
                color,
                openedOnStr,
                modifiedOnStr,
                is_active ? 1 : 0,
                account_id
            );

            return account;
        } else {
            // Insert new
            const stmt = this.db.prepare(`
                INSERT INTO accounts (
                    institution_name,
                    account_name,
                    account_type,
                    sub_type,
                    color,
                    opened_on,
                    created_on,
                    modified_on,
                    is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const result = stmt.run(
                institution_name,
                account_name,
                account_type,
                sub_type,
                color,
                openedOnStr,
                createdOnStr,
                modifiedOnStr,
                is_active ? 1 : 0
            );

            return {
                ...account,
                account_id: result.lastInsertRowid as number,
            };
        }
    }

    /**
     * Retrieves an account by ID.
     */
    findById(accountId: number): Account | null {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            SELECT * FROM accounts WHERE account_id = ?
        `);

        const row = stmt.get(accountId) as any;
        return row ? this.mapRowToAccount(row) : null;
    }

    /**
     * Retrieves all active accounts.
     */
    findAllActive(): Account[] {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            SELECT * FROM accounts WHERE is_active = 1 ORDER BY account_id
        `);

        const rows = stmt.all() as any[];
        return rows.map((row) => this.mapRowToAccount(row));
    }

    /**
     * Retrieves accounts by type.
     */
    findByType(type: AccountType): Account[] {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            SELECT * FROM accounts WHERE account_type = ? ORDER BY account_id
        `);

        const rows = stmt.all(type) as any[];
        return rows.map((row) => this.mapRowToAccount(row));
    }

    /**
     * Deactivates an account and its associated transactions.
     */
    deactivate(accountId: number): void {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const transaction = this.db.transaction(() => {
            const accountStmt = this.db.prepare(`
                UPDATE accounts SET is_active = 0 WHERE account_id = ?
            `);
            accountStmt.run(accountId);

            const transactionStmt = this.db.prepare(`
                UPDATE transactions SET is_active = 0 WHERE account_id = ?
            `);
            transactionStmt.run(accountId);
        });

        transaction();
    }

    /**
     * Maps a database row to an Account object.
     */
    private mapRowToAccount(row: any): Account {
        return {
            account_id: row.account_id,
            institution_name: row.institution_name,
            account_name: row.account_name,
            account_type: row.account_type,
            sub_type: row.sub_type,
            color: row.color,
            opened_on: new Date(row.opened_on),
            created_on: new Date(row.created_on),
            modified_on: new Date(row.modified_on),
            is_active: row.is_active === 1,
        };
    }

    /**
     * Converts a Date to ISO string format.
     */
    private dateToISOString(date: Date, format: "date" | "timestamp"): string {
        if (format === "date") {
            return date.toISOString().split("T")[0];
        } else {
            return date.toISOString();
        }
    }
}
