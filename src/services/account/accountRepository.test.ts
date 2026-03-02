jest.mock("../../database/databaseService");

import Database from "better-sqlite3";
import { AccountRepositoryImpl } from "./accountRepository";
import { Account, AccountType, AccountSubType } from "../../types/account";

describe("AccountRepositoryImpl", () => {
    let db: any;
    let repository: AccountRepositoryImpl;

    beforeEach(() => {
        // Create an in-memory SQLite database for testing
        db = new Database(":memory:");

        // Initialize schema
        db.exec(`
            CREATE TABLE accounts (
                account_id INTEGER PRIMARY KEY AUTOINCREMENT,
                institution_name TEXT NOT NULL,
                account_name TEXT NOT NULL,
                account_type TEXT NOT NULL,
                sub_type TEXT NOT NULL,
                color TEXT NOT NULL,
                opened_on TEXT NOT NULL,
                created_on TEXT NOT NULL,
                modified_on TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE transactions (
                transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL REFERENCES accounts(account_id),
                is_active INTEGER NOT NULL DEFAULT 1
            );
        `);

        repository = new AccountRepositoryImpl(db);
    });

    afterEach(() => {
        db.close();
    });

    describe("save", () => {
        test("inserts a new account and returns it with assigned ID", () => {
            const newAccount: Account = {
                account_id: 0,
                institution_name: "Wells Fargo",
                account_name: "Checking",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Checking,
                color: "#FF5733",
                opened_on: new Date("2024-01-01"),
                created_on: new Date("2024-03-01"),
                modified_on: new Date("2024-03-01"),
                is_active: true,
            };

            const saved = repository.save(newAccount);

            expect(saved.account_id).toBeGreaterThan(0);
            expect(saved.institution_name).toBe("Wells Fargo");
            expect(saved.account_name).toBe("Checking");
        });

        test("updates an existing account", () => {
            const account: Account = {
                account_id: 0,
                institution_name: "Bank A",
                account_name: "Old Name",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Savings,
                color: "#FF5733",
                opened_on: new Date("2024-01-01"),
                created_on: new Date("2024-03-01"),
                modified_on: new Date("2024-03-01"),
                is_active: true,
            };

            const saved = repository.save(account);
            const updated: Account = {
                ...saved,
                account_name: "New Name",
                modified_on: new Date("2024-03-02"),
            };

            const updatedResult = repository.save(updated);

            expect(updatedResult.account_name).toBe("New Name");
            expect(repository.findById(updatedResult.account_id)?.account_name).toBe("New Name");
        });
    });

    describe("findById", () => {
        test("returns an account by ID", () => {
            const account: Account = {
                account_id: 0,
                institution_name: "Bank B",
                account_name: "Test Account",
                account_type: AccountType.Liability,
                sub_type: AccountSubType.Credit,
                color: "#00FF00",
                opened_on: new Date("2024-02-01"),
                created_on: new Date("2024-03-01"),
                modified_on: new Date("2024-03-01"),
                is_active: true,
            };

            const saved = repository.save(account);
            const found = repository.findById(saved.account_id);

            expect(found).not.toBeNull();
            expect(found?.institution_name).toBe("Bank B");
            expect(found?.account_name).toBe("Test Account");
        });

        test("returns null if account not found", () => {
            const found = repository.findById(999);
            expect(found).toBeNull();
        });

        test("converts dates correctly from ISO strings", () => {
            const openedDate = new Date("2024-01-15");
            const account: Account = {
                account_id: 0,
                institution_name: "Bank C",
                account_name: "Date Test",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Savings,
                color: "#0000FF",
                opened_on: openedDate,
                created_on: new Date("2024-03-01T12:34:56.789Z"),
                modified_on: new Date("2024-03-01T12:34:56.789Z"),
                is_active: true,
            };

            const saved = repository.save(account);
            const found = repository.findById(saved.account_id);

            expect(found?.opened_on.toISOString()).toContain("2024-01-15");
        });
    });

    describe("findAllActive", () => {
        test("returns only active accounts", () => {
            const account1: Account = {
                account_id: 0,
                institution_name: "Bank 1",
                account_name: "Active 1",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Savings,
                color: "#FF0000",
                opened_on: new Date("2024-01-01"),
                created_on: new Date("2024-03-01"),
                modified_on: new Date("2024-03-01"),
                is_active: true,
            };

            const account2: Account = {
                account_id: 0,
                institution_name: "Bank 2",
                account_name: "Inactive 1",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Checking,
                color: "#00FF00",
                opened_on: new Date("2024-01-01"),
                created_on: new Date("2024-03-01"),
                modified_on: new Date("2024-03-01"),
                is_active: false,
            };

            const saved1 = repository.save(account1);
            const saved2 = repository.save(account2);

            const active = repository.findAllActive();

            expect(active.length).toBe(1);
            expect(active[0].account_id).toBe(saved1.account_id);
        });

        test("returns empty array if no active accounts", () => {
            const account: Account = {
                account_id: 0,
                institution_name: "Bank",
                account_name: "Test",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Savings,
                color: "#FF0000",
                opened_on: new Date("2024-01-01"),
                created_on: new Date("2024-03-01"),
                modified_on: new Date("2024-03-01"),
                is_active: false,
            };

            repository.save(account);
            const active = repository.findAllActive();

            expect(active).toEqual([]);
        });
    });

    describe("findByType", () => {
        test("returns accounts matching type", () => {
            const asset1: Account = {
                account_id: 0,
                institution_name: "Bank 1",
                account_name: "Asset Account",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Savings,
                color: "#FF0000",
                opened_on: new Date("2024-01-01"),
                created_on: new Date("2024-03-01"),
                modified_on: new Date("2024-03-01"),
                is_active: true,
            };

            const liability1: Account = {
                account_id: 0,
                institution_name: "Bank 2",
                account_name: "Liability Account",
                account_type: AccountType.Liability,
                sub_type: AccountSubType.Credit,
                color: "#00FF00",
                opened_on: new Date("2024-01-01"),
                created_on: new Date("2024-03-01"),
                modified_on: new Date("2024-03-01"),
                is_active: true,
            };

            repository.save(asset1);
            repository.save(liability1);

            const assets = repository.findByType(AccountType.Asset);
            const liabilities = repository.findByType(AccountType.Liability);

            expect(assets.length).toBe(1);
            expect(assets[0].account_type).toBe(AccountType.Asset);

            expect(liabilities.length).toBe(1);
            expect(liabilities[0].account_type).toBe(AccountType.Liability);
        });
    });

    describe("deactivate", () => {
        test("deactivates an account and its transactions", () => {
            const account: Account = {
                account_id: 0,
                institution_name: "Bank",
                account_name: "Test",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Savings,
                color: "#FF0000",
                opened_on: new Date("2024-01-01"),
                created_on: new Date("2024-03-01"),
                modified_on: new Date("2024-03-01"),
                is_active: true,
            };

            const saved = repository.save(account);

            // Insert a transaction for this account
            db.prepare(`
                INSERT INTO transactions (account_id, is_active) VALUES (?, ?)
            `).run(saved.account_id, 1);

            // Deactivate the account
            repository.deactivate(saved.account_id);

            // Verify account is inactive
            const found = repository.findById(saved.account_id);
            expect(found?.is_active).toBe(false);

            // Verify transactions are inactive
            const transaction = db.prepare(`
                SELECT * FROM transactions WHERE account_id = ?
            `).get(saved.account_id) as any;

            expect(transaction.is_active).toBe(0);
        });
    });

    describe("error handling", () => {
        test("throws when no database connection", () => {
            const badRepository = new AccountRepositoryImpl(null as any);

            expect(() => badRepository.findAllActive()).toThrow(
                "No active database connection"
            );
        });
    });
});
