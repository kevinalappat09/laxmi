/**
 * @module transactionRepository.test
 * @description Unit tests for TransactionRepositoryImpl
 */

import Database from "better-sqlite3";
import { TransactionRepositoryImpl } from "./transactionRepository";
import {
    Transaction,
    TransactionType,
    Classification,
    GroupByField,
    AggregateFunction,
} from "../../types/transaction";

describe("TransactionRepositoryImpl", () => {
    let mockDb: Database.Database;
    let repository: TransactionRepositoryImpl;
    let testAccountId: number;
    let testCategoryId: number;

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
        `);

        mockDb.exec(`
            CREATE TABLE categories (
                category_id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_name TEXT NOT NULL UNIQUE,
                parent_category_id INTEGER,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_on TEXT NOT NULL,
                modified_on TEXT NOT NULL,
                FOREIGN KEY (parent_category_id) REFERENCES categories(category_id) ON DELETE RESTRICT
            );
        `);

        mockDb.exec(`
            CREATE TABLE transactions (
                transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                transaction_date TEXT NOT NULL,
                transaction_type TEXT NOT NULL CHECK(
                    transaction_type IN ('withdraw', 'deposit', 'transfer')
                ),
                amount DECIMAL NOT NULL CHECK(amount > 0),
                category_id INTEGER,
                classification TEXT NOT NULL CHECK(
                    classification IN ('needs', 'wants', 'unnecessary', 'wasteful')
                ),
                note TEXT,
                transfer_account_id INTEGER,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_on TEXT NOT NULL,
                modified_on TEXT NOT NULL,
                FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE RESTRICT,
                FOREIGN KEY (transfer_account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
            );
            
            CREATE INDEX idx_transactions_account_date ON transactions(account_id, transaction_date);
            CREATE INDEX idx_transactions_category ON transactions(category_id);
            CREATE INDEX idx_transactions_type ON transactions(transaction_type);
            CREATE INDEX idx_transactions_classification ON transactions(classification);
        `);

        mockDb.pragma("foreign_keys = ON");

        const accountStmt = mockDb.prepare(`
            INSERT INTO accounts (
                institution_name, account_name, account_type, sub_type, color, 
                opened_on, created_on, modified_on, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const accountResult = accountStmt.run(
            "Test Bank",
            "Checking",
            "asset",
            "checking",
            "#FF5733",
            "2025-01-01",
            "2025-01-01T00:00:00.000Z",
            "2025-01-01T00:00:00.000Z",
            1
        );
        testAccountId = accountResult.lastInsertRowid as number;

        const categoryStmt = mockDb.prepare(`
            INSERT INTO categories (category_name, parent_category_id, is_active, created_on, modified_on)
            VALUES (?, ?, ?, ?, ?)
        `);
        const categoryResult = categoryStmt.run(
            "Groceries",
            null,
            1,
            "2025-01-01T00:00:00.000Z",
            "2025-01-01T00:00:00.000Z"
        );
        testCategoryId = categoryResult.lastInsertRowid as number;

        repository = new TransactionRepositoryImpl(mockDb as any);
    });

    afterEach(() => {
        mockDb.close();
    });

    describe("save", () => {
        it("should insert a new transaction and return with generated ID", () => {
            const transaction: Transaction = {
                account_id: testAccountId,
                transaction_date: new Date("2025-03-01"),
                transaction_type: TransactionType.Deposit,
                amount: 100.5,
                category_id: testCategoryId,
                classification: Classification.Needs,
                note: "Test note",
                is_active: true,
                created_on: new Date("2025-03-01T10:00:00Z"),
                modified_on: new Date("2025-03-01T10:00:00Z"),
            };

            const result = repository.save(transaction);

            expect(result.transaction_id).toBeDefined();
            expect(result.transaction_id).toBeGreaterThan(0);
            expect(result.account_id).toBe(testAccountId);
            expect(result.amount).toBe(100.5);
        });

        it("should update an existing transaction", () => {
            const transaction: Transaction = {
                account_id: testAccountId,
                transaction_date: new Date("2025-03-01"),
                transaction_type: TransactionType.Deposit,
                amount: 100,
                category_id: testCategoryId,
                classification: Classification.Needs,
                is_active: true,
                created_on: new Date("2025-03-01T10:00:00Z"),
                modified_on: new Date("2025-03-01T10:00:00Z"),
            };

            const saved = repository.save(transaction);

            const updated: Transaction = {
                ...saved,
                amount: 150,
                modified_on: new Date("2025-03-02T10:00:00Z"),
            };

            const result = repository.save(updated);

            expect(result.transaction_id).toBe(saved.transaction_id);
            expect(result.amount).toBe(150);
        });

        it("should handle optional fields correctly", () => {
            const transaction: Transaction = {
                account_id: testAccountId,
                transaction_date: new Date("2025-03-01"),
                transaction_type: TransactionType.Withdraw,
                amount: 50,
                classification: Classification.Wants,
                is_active: true,
                created_on: new Date("2025-03-01T10:00:00Z"),
                modified_on: new Date("2025-03-01T10:00:00Z"),
            };

            const result = repository.save(transaction);

            expect(result.transaction_id).toBeDefined();
            expect(result.note).toBeUndefined();
            expect(result.category_id).toBeUndefined();
            expect(result.transfer_account_id).toBeUndefined();
        });
    });

    describe("findById", () => {
        it("should retrieve an active transaction by ID", () => {
            const transaction: Transaction = {
                account_id: testAccountId,
                transaction_date: new Date("2025-03-01"),
                transaction_type: TransactionType.Deposit,
                amount: 200,
                classification: Classification.Needs,
                is_active: true,
                created_on: new Date("2025-03-01T10:00:00Z"),
                modified_on: new Date("2025-03-01T10:00:00Z"),
            };

            const saved = repository.save(transaction);
            const found = repository.findById(saved.transaction_id!);

            expect(found).not.toBeNull();
            expect(found?.transaction_id).toBe(saved.transaction_id);
            expect(found?.amount).toBe(200);
        });

        it("should return null for non-existent transaction", () => {
            const found = repository.findById(9999);
            expect(found).toBeNull();
        });

        it("should not return inactive transactions", () => {
            const transaction: Transaction = {
                account_id: testAccountId,
                transaction_date: new Date("2025-03-01"),
                transaction_type: TransactionType.Deposit,
                amount: 100,
                classification: Classification.Needs,
                is_active: true,
                created_on: new Date("2025-03-01T10:00:00Z"),
                modified_on: new Date("2025-03-01T10:00:00Z"),
            };

            const saved = repository.save(transaction);
            repository.delete(saved.transaction_id!);

            const found = repository.findById(saved.transaction_id!);
            expect(found).toBeNull();
        });
    });

    describe("findByAccountId", () => {
        it("should retrieve all active transactions for an account", () => {
            repository.save({
                account_id: testAccountId,
                transaction_date: new Date("2025-03-01"),
                transaction_type: TransactionType.Deposit,
                amount: 100,
                classification: Classification.Needs,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.save({
                account_id: testAccountId,
                transaction_date: new Date("2025-03-02"),
                transaction_type: TransactionType.Withdraw,
                amount: 50,
                classification: Classification.Wants,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const transactions = repository.findByAccountId(testAccountId);

            expect(transactions).toHaveLength(2);
            expect(transactions[0].amount).toBe(50);// Most recent first
            expect(transactions[1].amount).toBe(100);
        });

        it("should not return transactions from other accounts", () => {
            const otherAccountStmt = mockDb.prepare(`
                INSERT INTO accounts (
                    institution_name, account_name, account_type, sub_type, color, 
                    opened_on, created_on, modified_on, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const otherResult = otherAccountStmt.run(
                "Other Bank",
                "Savings",
                "asset",
                "savings",
                "#00FF00",
                "2025-01-01",
                "2025-01-01T00:00:00.000Z",
                "2025-01-01T00:00:00.000Z",
                1
            );
            const otherAccountId = otherResult.lastInsertRowid as number;

            repository.save({
                account_id: testAccountId,
                transaction_date: new Date("2025-03-01"),
                transaction_type: TransactionType.Deposit,
                amount: 100,
                classification: Classification.Needs,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.save({
                account_id: otherAccountId,
                transaction_date: new Date("2025-03-02"),
                transaction_type: TransactionType.Withdraw,
                amount: 50,
                classification: Classification.Wants,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            const transactions = repository.findByAccountId(testAccountId);

            expect(transactions).toHaveLength(1);
            expect(transactions[0].amount).toBe(100);
        });

        it("should not return inactive transactions", () => {
            const t1 = repository.save({
                account_id: testAccountId,
                transaction_date: new Date("2025-03-01"),
                transaction_type: TransactionType.Deposit,
                amount: 100,
                classification: Classification.Needs,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.save({
                account_id: testAccountId,
                transaction_date: new Date("2025-03-02"),
                transaction_type: TransactionType.Withdraw,
                amount: 50,
                classification: Classification.Wants,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.delete(t1.transaction_id!);

            const transactions = repository.findByAccountId(testAccountId);

            expect(transactions).toHaveLength(1);
            expect(transactions[0].amount).toBe(50);
        });
    });

    describe("delete", () => {
        it("should soft-delete a transaction", () => {
            const transaction = repository.save({
                account_id: testAccountId,
                transaction_date: new Date("2025-03-01"),
                transaction_type: TransactionType.Deposit,
                amount: 100,
                classification: Classification.Needs,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.delete(transaction.transaction_id!);

            const found = repository.findById(transaction.transaction_id!);
            expect(found).toBeNull();
        });
    });

    describe("findWithFilter", () => {
        beforeEach(() => {
            repository.save({
                account_id: testAccountId,
                transaction_date: new Date("2025-01-15"),
                transaction_type: TransactionType.Deposit,
                amount: 500,
                category_id: testCategoryId,
                classification: Classification.Needs,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.save({
                account_id: testAccountId,
                transaction_date: new Date("2025-02-10"),
                transaction_type: TransactionType.Withdraw,
                amount: 50,
                category_id: testCategoryId,
                classification: Classification.Wants,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.save({
                account_id: testAccountId,
                transaction_date: new Date("2025-03-05"),
                transaction_type: TransactionType.Withdraw,
                amount: 25,
                classification: Classification.Wasteful,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });
        });

        it("should filter by date range", () => {
            const results = repository.findWithFilter({
                accountId: testAccountId,
                fromDate: new Date("2025-02-01"),
                toDate: new Date("2025-02-28"),
            });

            expect(results).toHaveLength(1);
            expect(results[0].amount).toBe(50);
        });

        it("should filter by transaction type", () => {
            const results = repository.findWithFilter({
                accountId: testAccountId,
                types: new Set([TransactionType.Withdraw]),
            });

            expect(results).toHaveLength(2);
            expect(results.every((t) => t.transaction_type === TransactionType.Withdraw)).toBe(true);
        });

        it("should filter by classification", () => {
            const results = repository.findWithFilter({
                accountId: testAccountId,
                classifications: new Set([Classification.Needs, Classification.Wants]),
            });

            expect(results).toHaveLength(2);
        });

        it("should filter by amount range", () => {
            const results = repository.findWithFilter({
                accountId: testAccountId,
                minAmount: 30,
                maxAmount: 100,
            });

            expect(results).toHaveLength(1);
            expect(results[0].amount).toBe(50);
        });

        it("should combine multiple filters", () => {
            const results = repository.findWithFilter({
                accountId: testAccountId,
                fromDate: new Date("2025-01-01"),
                toDate: new Date("2025-03-31"),
                types: new Set([TransactionType.Withdraw]),
                minAmount: 20,
            });

            expect(results).toHaveLength(2);
        });
    });

    describe("aggregate", () => {
        beforeEach(() => {
            repository.save({
                account_id: testAccountId,
                transaction_date: new Date("2025-01-15"),
                transaction_type: TransactionType.Deposit,
                amount: 500,
                category_id: testCategoryId,
                classification: Classification.Needs,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.save({
                account_id: testAccountId,
                transaction_date: new Date("2025-02-10"),
                transaction_type: TransactionType.Withdraw,
                amount: 50,
                category_id: testCategoryId,
                classification: Classification.Wants,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });

            repository.save({
                account_id: testAccountId,
                transaction_date: new Date("2025-02-15"),
                transaction_type: TransactionType.Withdraw,
                amount: 75,
                classification: Classification.Wasteful,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            });
        });

        it("should aggregate by classification", () => {
            const results = repository.aggregate({
                accountId: testAccountId,
                groupBy: [GroupByField.Classification],
                aggregateFunction: AggregateFunction.Sum,
            });

            expect(results.length).toBeGreaterThan(0);
            expect(results.some((r) => r.classification === Classification.Needs)).toBe(true);
        });

        it("should count transactions by type", () => {
            const results = repository.aggregate({
                accountId: testAccountId,
                groupBy: [GroupByField.Type],
                aggregateFunction: AggregateFunction.Count,
            });

            expect(results.length).toBeGreaterThan(0);
            expect(results.every((r) => r.value >= 0)).toBe(true);
        });

        it("should aggregate by month", () => {
            const results = repository.aggregate({
                accountId: testAccountId,
                groupBy: [GroupByField.Month],
                aggregateFunction: AggregateFunction.Sum,
            });

            expect(results.length).toBeGreaterThan(0);
            expect(results[0].month).toBeDefined();
        });

        it("should handle multi-level grouping", () => {
            const results = repository.aggregate({
                accountId: testAccountId,
                groupBy: [GroupByField.Type, GroupByField.Classification],
                aggregateFunction: AggregateFunction.Sum,
            });

            expect(results.length).toBeGreaterThan(0);
        });

        it("should apply filters before aggregation", () => {
            const results = repository.aggregate({
                accountId: testAccountId,
                groupBy: [GroupByField.Classification],
                aggregateFunction: AggregateFunction.Sum,
                minAmount: 50,
            });
            const totalValue = results.reduce((sum, r) => sum + r.value, 0);
            expect(totalValue).toBeCloseTo(625, 2);
        });
    });

    describe("deleteByAccountId", () => {
        it("should soft-delete all transactions for a given account", () => {
            const account2Result = mockDb.prepare(`INSERT INTO accounts (institution_name, account_name, account_type, sub_type, color, opened_on, created_on, modified_on, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("Test Bank", "Savings", "ASSET", "SAVINGS", "#FF5733", "2024-01-01", new Date().toISOString(), new Date().toISOString(), 1);
            const account2Id = account2Result.lastInsertRowid as number;

            const txn1: Transaction = {
                account_id: testAccountId,
                transaction_date: new Date("2024-01-15"),
                transaction_type: TransactionType.Deposit,
                amount: 100,
                category_id: testCategoryId,
                classification: Classification.Needs,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            };

            const txn2: Transaction = {
                account_id: testAccountId,
                transaction_date: new Date("2024-01-16"),
                transaction_type: TransactionType.Withdraw,
                amount: 50,
                category_id: testCategoryId,
                classification: Classification.Wants,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            };

            const txn3: Transaction = {
                account_id: account2Id,
                transaction_date: new Date("2024-01-17"),
                transaction_type: TransactionType.Deposit,
                amount: 200,
                category_id: testCategoryId,
                classification: Classification.Needs,
                is_active: true,
                created_on: new Date(),
                modified_on: new Date(),
            };

            const saved1 = repository.save(txn1);
            const saved2 = repository.save(txn2);
            const saved3 = repository.save(txn3);

            repository.deleteByAccountId(testAccountId);

            const remainingForTestAccount = repository.findByAccountId(testAccountId);
            const remainingForAccount2 = repository.findByAccountId(account2Id);

            expect(remainingForTestAccount.length).toBe(0);
            expect(remainingForAccount2.length).toBe(1);
            expect(remainingForAccount2[0].transaction_id).toBe(saved3.transaction_id);
        });
    });
});
