jest.mock("../profileSession/profileSessionService");

import { TransactionServiceImpl } from "./transactionService";
import { profileSessionService } from "../profileSession/profileSessionService";
import { TransactionType, Classification } from "../../types/transaction";
import Database from "better-sqlite3";

describe("TransactionServiceImpl", () => {
    let service: TransactionServiceImpl;
    let mockDb: any;
    let accountId: number;
    let categoryId: number;

    beforeEach(() => {
        mockDb = new Database(":memory:");
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

            CREATE TABLE categories (
                category_id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_name TEXT NOT NULL UNIQUE,
                parent_category_id INTEGER,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_on TEXT NOT NULL,
                modified_on TEXT NOT NULL,
                FOREIGN KEY (parent_category_id) REFERENCES categories(category_id)
            );

            CREATE TABLE transactions (
                transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL REFERENCES accounts(account_id),
                transaction_date TEXT NOT NULL,
                transaction_type TEXT NOT NULL CHECK(
                    transaction_type IN ('withdraw', 'deposit', 'transfer')
                ),
                amount DECIMAL NOT NULL CHECK(amount > 0),
                category_id INTEGER REFERENCES categories(category_id),
                classification TEXT NOT NULL CHECK(
                    classification IN ('needs', 'wants', 'unnecessary', 'wasteful')
                ),
                note TEXT,
                transfer_account_id INTEGER REFERENCES accounts(account_id),
                is_active INTEGER NOT NULL DEFAULT 1,
                created_on TEXT NOT NULL,
                modified_on TEXT NOT NULL
            );
        `);
        const accountStmt = mockDb.prepare(`
            INSERT INTO accounts (
                institution_name, account_name, account_type, sub_type, color, opened_on, created_on, modified_on
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const accountResult = accountStmt.run(
            "Test Bank",
            "Checking",
            "ASSET",
            "CHECKING",
            "#FF5733",
            "2024-01-01",
            new Date().toISOString(),
            new Date().toISOString()
        );
        accountId = accountResult.lastInsertRowid as number;

        const categoryStmt = mockDb.prepare(`
            INSERT INTO categories (category_name, is_active, created_on, modified_on)
            VALUES (?, ?, ?, ?)
        `);
        const categoryResult = categoryStmt.run(
            "Groceries",
            1,
            new Date().toISOString(),
            new Date().toISOString()
        );
        categoryId = categoryResult.lastInsertRowid as number;
        (profileSessionService.getDatabaseConnection as jest.Mock).mockReturnValue(mockDb);

        service = new TransactionServiceImpl();
    });

    afterEach(() => {
        mockDb.close();
        jest.clearAllMocks();
    });

    describe("createTransaction", () => {
        test("creates a new transaction with valid data", () => {
            const request = {
                account_id: accountId,
                transaction_date: new Date("2024-03-01"),
                transaction_type: TransactionType.Deposit,
                amount: 100.50,
                category_id: categoryId,
                classification: Classification.Needs,
                note: "Grocery shopping",
            };

            const created = service.createTransaction(request);

            expect(created.transaction_id).toBeGreaterThan(0);
            expect(created.account_id).toBe(accountId);
            expect(created.amount).toBe(100.50);
            expect(created.is_active).toBe(true);
            expect(created.created_on).toBeDefined();
        });

        test("creates transaction without optional fields", () => {
            const request = {
                account_id: accountId,
                transaction_date: new Date("2024-03-01"),
                transaction_type: TransactionType.Withdraw,
                amount: 50,
                classification: Classification.Wants,
            };

            const created = service.createTransaction(request);

            expect(created.transaction_id).toBeGreaterThan(0);
            expect(created.category_id).toBeUndefined();
            expect(created.note).toBeUndefined();
            expect(created.transfer_account_id).toBeUndefined();
        });

        test("throws when account_id is missing", () => {
            const request = {
                account_id: 0,
                transaction_date: new Date("2024-03-01"),
                transaction_type: TransactionType.Deposit,
                amount: 100,
                classification: Classification.Needs,
            };

            expect(() => service.createTransaction(request)).toThrow("account_id is required");
        });

        test("throws when amount is zero or negative", () => {
            const request = {
                account_id: accountId,
                transaction_date: new Date("2024-03-01"),
                transaction_type: TransactionType.Deposit,
                amount: -50,
                classification: Classification.Needs,
            };

            expect(() => service.createTransaction(request)).toThrow(
                "amount must be greater than 0"
            );
        });

        test("throws when classification is missing", () => {
            const request = {
                account_id: accountId,
                transaction_date: new Date("2024-03-01"),
                transaction_type: TransactionType.Deposit,
                amount: 100,
            } as any;

            expect(() => service.createTransaction(request)).toThrow(
                "classification is required"
            );
        });

        test("throws for non-existent account", () => {
            const request = {
                account_id: 9999,
                transaction_date: new Date("2024-03-01"),
                transaction_type: TransactionType.Deposit,
                amount: 100,
                classification: Classification.Needs,
            };

            expect(() => service.createTransaction(request)).toThrow(
                "Account with ID 9999 does not exist"
            );
        });

        test("throws for non-existent category", () => {
            const request = {
                account_id: accountId,
                transaction_date: new Date("2024-03-01"),
                transaction_type: TransactionType.Deposit,
                amount: 100,
                category_id: 9999,
                classification: Classification.Needs,
            };

            expect(() => service.createTransaction(request)).toThrow(
                "Category with ID 9999 does not exist"
            );
        });

        test("throws when transfer_account_id equals account_id", () => {
            const request = {
                account_id: accountId,
                transaction_date: new Date("2024-03-01"),
                transaction_type: TransactionType.Transfer,
                amount: 100,
                classification: Classification.Needs,
                transfer_account_id: accountId,
            };

            expect(() => service.createTransaction(request)).toThrow(
                "transfer_account_id cannot be the same as account_id"
            );
        });

        test("throws when no database connection", () => {
            (profileSessionService.getDatabaseConnection as jest.Mock).mockReturnValue(null);

            const request = {
                account_id: accountId,
                transaction_date: new Date("2024-03-01"),
                transaction_type: TransactionType.Deposit,
                amount: 100,
                classification: Classification.Needs,
            };

            expect(() => service.createTransaction(request)).toThrow(
                "No active database connection"
            );
        });
    });

    describe("updateTransaction", () => {
        let transactionId: number;

        beforeEach(() => {
            const stmt = mockDb.prepare(`
                INSERT INTO transactions (
                    account_id, transaction_date, transaction_type, amount, category_id,
                    classification, note, is_active, created_on, modified_on
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
                accountId,
                "2024-03-01",
                "deposit",
                100,
                categoryId,
                "needs",
                "test",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );
            transactionId = result.lastInsertRowid as number;
        });

        test("updates an existing transaction", () => {
            const request = {
                amount: 150,
                note: "updated note",
            };

            const updated = service.updateTransaction(transactionId, request);

            expect(updated.transaction_id).toBe(transactionId);
            expect(updated.amount).toBe(150);
            expect(updated.note).toBe("updated note");
            expect(updated.modified_on).toBeDefined();
        });

        test("throws when transaction not found", () => {
            const request = {
                amount: 150,
            };

            expect(() => service.updateTransaction(9999, request)).toThrow(
                "Transaction with ID 9999 not found"
            );
        });

        test("throws when updated amount is invalid", () => {
            const request = {
                amount: -50,
            };

            expect(() => service.updateTransaction(transactionId, request)).toThrow(
                "amount must be greater than 0"
            );
        });

        test("throws when setting self as transfer account", () => {
            const request = {
                transfer_account_id: accountId,
            };

            expect(() => service.updateTransaction(transactionId, request)).toThrow(
                "transfer_account_id cannot be the same as account_id"
            );
        });
    });

    describe("deleteTransaction", () => {
        let transactionId: number;

        beforeEach(() => {
            const stmt = mockDb.prepare(`
                INSERT INTO transactions (
                    account_id, transaction_date, transaction_type, amount, category_id,
                    classification, is_active, created_on, modified_on
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
                accountId,
                "2024-03-01",
                "deposit",
                100,
                categoryId,
                "needs",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );
            transactionId = result.lastInsertRowid as number;
        });

        test("soft deletes a transaction", () => {
            service.deleteTransaction(transactionId);

            const stmt = mockDb.prepare(`SELECT is_active FROM transactions WHERE transaction_id = ?`);
            const row = stmt.get(transactionId) as any;

            expect(row.is_active).toBe(0);
        });

        test("throws when transaction not found", () => {
            expect(() => service.deleteTransaction(9999)).toThrow(
                "Transaction with ID 9999 not found"
            );
        });
    });

    describe("getTransaction", () => {
        let transactionId: number;

        beforeEach(() => {
            const stmt = mockDb.prepare(`
                INSERT INTO transactions (
                    account_id, transaction_date, transaction_type, amount, category_id,
                    classification, is_active, created_on, modified_on
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
                accountId,
                "2024-03-01",
                "deposit",
                100,
                categoryId,
                "needs",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );
            transactionId = result.lastInsertRowid as number;
        });

        test("retrieves a transaction by ID", () => {
            const transaction = service.getTransaction(transactionId);

            expect(transaction.transaction_id).toBe(transactionId);
            expect(transaction.account_id).toBe(accountId);
            expect(transaction.amount).toBe(100);
        });

        test("throws when transaction not found", () => {
            expect(() => service.getTransaction(9999)).toThrow(
                "Transaction with ID 9999 not found"
            );
        });
    });

    describe("getTransactionsByAccount", () => {
        beforeEach(() => {
            const stmt = mockDb.prepare(`
                INSERT INTO transactions (
                    account_id, transaction_date, transaction_type, amount,
                    classification, is_active, created_on, modified_on
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                accountId,
                "2024-03-01",
                "deposit",
                100,
                "needs",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );

            stmt.run(
                accountId,
                "2024-03-02",
                "withdraw",
                50,
                "wants",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );
        });

        test("retrieves all transactions for an account", () => {
            const transactions = service.getTransactionsByAccount(accountId);

            expect(transactions).toHaveLength(2);
            expect(transactions[0].account_id).toBe(accountId);
        });

        test("returns empty array for account with no transactions", () => {
            const accountStmt = mockDb.prepare(`
                INSERT INTO accounts (
                    institution_name, account_name, account_type, sub_type, color, opened_on, created_on, modified_on
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const result = accountStmt.run(
                "Another Bank",
                "Savings",
                "ASSET",
                "SAVINGS",
                "#123456",
                "2024-01-01",
                new Date().toISOString(),
                new Date().toISOString()
            );
            const newAccountId = result.lastInsertRowid as number;

            const transactions = service.getTransactionsByAccount(newAccountId);

            expect(transactions).toHaveLength(0);
        });
    });

    describe("findWithFilter", () => {
        beforeEach(() => {
            const stmt = mockDb.prepare(`
                INSERT INTO transactions (
                    account_id, transaction_date, transaction_type, amount,
                    classification, is_active, created_on, modified_on
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                accountId,
                "2024-03-01",
                "deposit",
                100,
                "needs",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );

            stmt.run(
                accountId,
                "2024-03-15",
                "withdraw",
                50,
                "wants",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );
        });

        test("filters transactions by date range", () => {
            const query = {
                accountId,
                fromDate: new Date("2024-03-10"),
                toDate: new Date("2024-03-20"),
            };

            const transactions = service.findWithFilter(query);

            expect(transactions).toHaveLength(1);
            expect(transactions[0].amount).toBe(50);
        });

        test("filters transactions by classification", () => {
            const query = {
                accountId,
                classifications: new Set([Classification.Needs]),
            };

            const transactions = service.findWithFilter(query);

            expect(transactions).toHaveLength(1);
            expect(transactions[0].classification).toBe(Classification.Needs);
        });
    });

    describe("aggregate", () => {
        beforeEach(() => {
            const stmt = mockDb.prepare(`
                INSERT INTO transactions (
                    account_id, transaction_date, transaction_type, amount,
                    classification, is_active, created_on, modified_on
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                accountId,
                "2024-03-01",
                "deposit",
                100,
                "needs",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );

            stmt.run(
                accountId,
                "2024-03-01",
                "withdraw",
                50,
                "needs",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );

            stmt.run(
                accountId,
                "2024-03-02",
                "withdraw",
                25,
                "wants",
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );
        });

        test("aggregates transactions by classification", () => {
            const query = {
                accountId,
                groupBy: ["CLASSIFICATION" as any],
            };

            const rows = service.aggregate(query);

            expect(rows.length).toBeGreaterThan(0);
            expect(rows[0].value).toBeDefined();
        });
    });
});
