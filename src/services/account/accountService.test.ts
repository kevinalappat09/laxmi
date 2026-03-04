jest.mock("../profileSession/profileSessionService");

import { AccountServiceImpl } from "./accountService";
import { profileSessionService } from "../profileSession/profileSessionService";
import { AccountType, AccountSubType } from "../../types/account";
import Database from "better-sqlite3";

describe("AccountServiceImpl", () => {
    let service: AccountServiceImpl;
    let mockDb: any;

    beforeEach(() => {
        // Create an in-memory SQLite database for testing
        mockDb = new Database(":memory:");

        // Initialize schema
        mockDb.exec(`
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
                transaction_date TEXT NOT NULL,
                transaction_type TEXT NOT NULL,
                amount DECIMAL NOT NULL,
                category_id INTEGER,
                classification TEXT NOT NULL,
                note TEXT,
                transfer_account_id INTEGER,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_on TEXT NOT NULL,
                modified_on TEXT NOT NULL
            );
        `);

        // Mock the profileSessionService to return our test database
        (profileSessionService.getDatabaseConnection as jest.Mock).mockReturnValue(mockDb);

        service = new AccountServiceImpl();
    });

    afterEach(() => {
        mockDb.close();
        jest.clearAllMocks();
    });

    describe("createAccount", () => {
        test("creates a new account with valid data", () => {
            const request = {
                institution_name: "Wells Fargo",
                account_name: "Checking",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Checking,
                color: "#FF5733",
                opened_on: new Date("2024-01-01"),
            };

            const created = service.createAccount(request);

            expect(created.account_id).toBeGreaterThan(0);
            expect(created.institution_name).toBe("Wells Fargo");
            expect(created.account_name).toBe("Checking");
            expect(created.is_active).toBe(true);
        });

        test("throws for invalid hex color", () => {
            const request = {
                institution_name: "Bank",
                account_name: "Test",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Savings,
                color: "InvalidColor",
                opened_on: new Date("2024-01-01"),
            };

            expect(() => service.createAccount(request)).toThrow("Invalid color format");
        });

        test("throws when no database connection", () => {
            (profileSessionService.getDatabaseConnection as jest.Mock).mockReturnValue(null);

            const request = {
                institution_name: "Bank",
                account_name: "Test",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Savings,
                color: "#FF5733",
                opened_on: new Date("2024-01-01"),
            };

            expect(() => service.createAccount(request)).toThrow(
                "No active database connection"
            );
        });
    });

    describe("updateAccount", () => {
        test("updates an existing account", () => {
            const createRequest = {
                institution_name: "Bank A",
                account_name: "Original Name",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Savings,
                color: "#FF0000",
                opened_on: new Date("2024-01-01"),
            };

            const created = service.createAccount(createRequest);

            const updateRequest = {
                account_name: "Updated Name",
                color: "#00FF00",
            };

            const updated = service.updateAccount(created.account_id, updateRequest);

            expect(updated.account_name).toBe("Updated Name");
            expect(updated.color).toBe("#00FF00");
            expect(updated.institution_name).toBe("Bank A");
        });

        test("throws for invalid hex color during update", () => {
            const createRequest = {
                institution_name: "Bank",
                account_name: "Test",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Savings,
                color: "#FF5733",
                opened_on: new Date("2024-01-01"),
            };

            const created = service.createAccount(createRequest);

            const updateRequest = {
                color: "BadColor",
            };

            expect(() => service.updateAccount(created.account_id, updateRequest)).toThrow(
                "Invalid color format"
            );
        });

        test("throws when account not found", () => {
            const updateRequest = {
                account_name: "New Name",
            };

            expect(() => service.updateAccount(999, updateRequest)).toThrow(
                "Account with ID 999 not found"
            );
        });
    });

    describe("deactivateAccount", () => {
        test("deactivates an account", () => {
            const createRequest = {
                institution_name: "Bank",
                account_name: "Test",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Savings,
                color: "#FF5733",
                opened_on: new Date("2024-01-01"),
            };

            const created = service.createAccount(createRequest);
            service.deactivateAccount(created.account_id);

            const account = service.getAccount(created.account_id);
            expect(account.is_active).toBe(false);
        });

        test("throws when account not found", () => {
            expect(() => service.deactivateAccount(999)).toThrow(
                "Account with ID 999 not found"
            );
        });
    });

    describe("getAccount", () => {
        test("retrieves an account by ID", () => {
            const createRequest = {
                institution_name: "Bank B",
                account_name: "Test Account",
                account_type: AccountType.Liability,
                sub_type: AccountSubType.Credit,
                color: "#00FF00",
                opened_on: new Date("2024-02-01"),
            };

            const created = service.createAccount(createRequest);
            const retrieved = service.getAccount(created.account_id);

            expect(retrieved.account_id).toBe(created.account_id);
            expect(retrieved.institution_name).toBe("Bank B");
        });

        test("throws when account not found", () => {
            expect(() => service.getAccount(999)).toThrow("Account with ID 999 not found");
        });
    });

    describe("listActiveAccounts", () => {
        test("returns all active accounts", () => {
            const request1 = {
                institution_name: "Bank 1",
                account_name: "Account 1",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Savings,
                color: "#FF0000",
                opened_on: new Date("2024-01-01"),
            };

            const request2 = {
                institution_name: "Bank 2",
                account_name: "Account 2",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Checking,
                color: "#00FF00",
                opened_on: new Date("2024-01-01"),
            };

            service.createAccount(request1);
            service.createAccount(request2);

            const active = service.listActiveAccounts();

            expect(active.length).toBe(2);
            expect(active.every((a) => a.is_active)).toBe(true);
        });

        test("excludes inactive accounts", () => {
            const request1 = {
                institution_name: "Bank 1",
                account_name: "Active",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Savings,
                color: "#FF0000",
                opened_on: new Date("2024-01-01"),
            };

            const request2 = {
                institution_name: "Bank 2",
                account_name: "Inactive",
                account_type: AccountType.Asset,
                sub_type: AccountSubType.Checking,
                color: "#00FF00",
                opened_on: new Date("2024-01-01"),
            };

            const created1 = service.createAccount(request1);
            const created2 = service.createAccount(request2);

            service.deactivateAccount(created2.account_id);

            const active = service.listActiveAccounts();

            expect(active.length).toBe(1);
            expect(active[0].account_id).toBe(created1.account_id);
        });
    });

    describe("error handling", () => {
        test("throws when no database connection on createAccount", () => {
            (profileSessionService.getDatabaseConnection as jest.Mock).mockReturnValue(null);

            expect(() =>
                service.createAccount({
                    institution_name: "Bank",
                    account_name: "Test",
                    account_type: AccountType.Asset,
                    sub_type: AccountSubType.Savings,
                    color: "#FF5733",
                    opened_on: new Date("2024-01-01"),
                })
            ).toThrow("No active database connection");
        });
    });
});
