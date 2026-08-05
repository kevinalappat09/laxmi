jest.mock("../profileSession/profileSessionService");

import Database from "better-sqlite3";
import { CreditCardServiceImpl } from "./creditCardService";
import { AccountServiceImpl } from "../account/accountService";
import { TransactionServiceImpl } from "../transaction/transactionService";
import { profileSessionService } from "../profileSession/profileSessionService";
import { AccountType, AccountSubType } from "../../types/account";
import { TransactionType, Classification } from "../../types/transaction";

describe("CreditCardServiceImpl", () => {
    let service: CreditCardServiceImpl;
    let accountService: AccountServiceImpl;
    let transactionService: TransactionServiceImpl;
    let mockDb: any;

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
                is_active INTEGER NOT NULL DEFAULT 1,
                metadata TEXT
            );

            CREATE TABLE transactions (
                transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                transaction_date TEXT NOT NULL,
                transaction_type TEXT NOT NULL,
                amount DECIMAL NOT NULL,
                category_id INTEGER,
                classification TEXT NOT NULL,
                payee TEXT,
                note TEXT,
                transfer_account_id INTEGER,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_on TEXT NOT NULL,
                modified_on TEXT NOT NULL
            );

            CREATE TABLE credit_cards (
                account_id INTEGER PRIMARY KEY REFERENCES accounts(account_id),
                credit_limit REAL NOT NULL,
                statement_day INTEGER NOT NULL,
                payment_due_day INTEGER NOT NULL,
                utilization_alert_threshold REAL NOT NULL DEFAULT 0.05,
                statement_reminder_lead_days INTEGER NOT NULL DEFAULT 5,
                payment_reminder_lead_days INTEGER NOT NULL DEFAULT 5,
                created_on TEXT NOT NULL,
                modified_on TEXT NOT NULL
            );
        `);

        (profileSessionService.getDatabaseConnection as jest.Mock).mockReturnValue(mockDb);

        service = new CreditCardServiceImpl();
        accountService = new AccountServiceImpl();
        transactionService = new TransactionServiceImpl();
    });

    afterEach(() => {
        mockDb.close();
        jest.clearAllMocks();
    });

    function createCreditAccount() {
        return accountService.createAccount({
            institution_name: "HDFC",
            account_name: "Regalia",
            account_type: AccountType.Liability,
            sub_type: AccountSubType.Credit,
            color: "#3498DB",
            opened_on: new Date("2024-01-01"),
        });
    }

    function createCheckingAccount() {
        return accountService.createAccount({
            institution_name: "HDFC",
            account_name: "Checking",
            account_type: AccountType.Asset,
            sub_type: AccountSubType.Checking,
            color: "#2ECC71",
            opened_on: new Date("2024-01-01"),
        });
    }

    describe("upsertCreditCardDetails", () => {
        test("creates details for a credit account", () => {
            const card = createCreditAccount();
            const details = service.upsertCreditCardDetails(card.account_id, {
                credit_limit: 1000,
                statement_day: 10,
                payment_due_day: 25,
            });

            expect(details.credit_limit).toBe(1000);
            expect(details.utilization_alert_threshold).toBe(0.05);
            expect(service.getCreditCardDetails(card.account_id)?.statement_day).toBe(10);
        });

        test("updates existing details and preserves created_on", () => {
            const card = createCreditAccount();
            const first = service.upsertCreditCardDetails(card.account_id, {
                credit_limit: 1000,
                statement_day: 10,
                payment_due_day: 25,
            });
            const second = service.upsertCreditCardDetails(card.account_id, {
                credit_limit: 2000,
            });

            expect(second.credit_limit).toBe(2000);
            expect(second.statement_day).toBe(10);
            expect(second.created_on.getTime()).toBe(first.created_on.getTime());
        });

        test("rejects a non-credit account", () => {
            const checking = createCheckingAccount();
            expect(() =>
                service.upsertCreditCardDetails(checking.account_id, {
                    credit_limit: 1000,
                    statement_day: 10,
                    payment_due_day: 25,
                })
            ).toThrow("credit account");
        });

        test("rejects an invalid credit limit", () => {
            const card = createCreditAccount();
            expect(() =>
                service.upsertCreditCardDetails(card.account_id, {
                    credit_limit: 0,
                    statement_day: 10,
                    payment_due_day: 25,
                })
            ).toThrow("credit_limit");
        });
    });

    describe("listCreditCardSummaries", () => {
        test("computes outstanding, available, and utilization including payments", () => {
            const card = createCreditAccount();
            const checking = createCheckingAccount();
            service.upsertCreditCardDetails(card.account_id, {
                credit_limit: 1000,
                statement_day: 10,
                payment_due_day: 25,
            });

            transactionService.createTransaction({
                account_id: card.account_id,
                transaction_date: new Date("2024-01-03"),
                transaction_type: TransactionType.Withdraw,
                amount: 200,
                classification: Classification.Needs,
            });
            transactionService.createTransaction({
                account_id: checking.account_id,
                transaction_date: new Date("2024-01-05"),
                transaction_type: TransactionType.Transfer,
                amount: 50,
                classification: Classification.Needs,
                transfer_account_id: card.account_id,
            });

            const [summary] = service.listCreditCardSummaries(new Date(Date.UTC(2024, 0, 8)));

            expect(summary.outstanding).toBe(150);
            expect(summary.available).toBe(850);
            expect(summary.utilization).toBeCloseTo(0.15);
            expect(summary.next_statement_date.getTime()).toBe(Date.UTC(2024, 0, 10));
            expect(summary.next_due_date.getTime()).toBe(Date.UTC(2024, 0, 25));
        });
    });

    describe("getNotifications", () => {
        test("emits a utilization alert before statement when over threshold", () => {
            const card = createCreditAccount();
            service.upsertCreditCardDetails(card.account_id, {
                credit_limit: 1000,
                statement_day: 10,
                payment_due_day: 25,
            });
            transactionService.createTransaction({
                account_id: card.account_id,
                transaction_date: new Date("2024-01-03"),
                transaction_type: TransactionType.Withdraw,
                amount: 200,
                classification: Classification.Needs,
            });

            const notifications = service.getNotifications(new Date(Date.UTC(2024, 0, 8)));
            const utilization = notifications.find((n) => n.kind === "credit_utilization");

            expect(utilization).toBeDefined();
        });

        test("does not emit a utilization alert when below threshold", () => {
            const card = createCreditAccount();
            service.upsertCreditCardDetails(card.account_id, {
                credit_limit: 10000,
                statement_day: 10,
                payment_due_day: 25,
            });
            transactionService.createTransaction({
                account_id: card.account_id,
                transaction_date: new Date("2024-01-03"),
                transaction_type: TransactionType.Withdraw,
                amount: 200,
                classification: Classification.Needs,
            });

            const notifications = service.getNotifications(new Date(Date.UTC(2024, 0, 8)));
            expect(notifications.some((n) => n.kind === "credit_utilization")).toBe(false);
        });

        test("emits an approaching-limit alert regardless of statement date", () => {
            const card = createCreditAccount();
            service.upsertCreditCardDetails(card.account_id, {
                credit_limit: 1000,
                statement_day: 28,
                payment_due_day: 15,
            });
            transactionService.createTransaction({
                account_id: card.account_id,
                transaction_date: new Date("2024-01-03"),
                transaction_type: TransactionType.Withdraw,
                amount: 950,
                classification: Classification.Needs,
            });

            const notifications = service.getNotifications(new Date(Date.UTC(2024, 0, 8)));
            const approaching = notifications.find(
                (n) => n.kind === "credit_limit_approaching"
            );

            expect(approaching).toBeDefined();
            expect(
                approaching &&
                    approaching.kind === "credit_limit_approaching" &&
                    approaching.available
            ).toBe(50);
        });

        test("does not emit an approaching-limit alert below 90% utilization", () => {
            const card = createCreditAccount();
            service.upsertCreditCardDetails(card.account_id, {
                credit_limit: 1000,
                statement_day: 10,
                payment_due_day: 25,
            });
            transactionService.createTransaction({
                account_id: card.account_id,
                transaction_date: new Date("2024-01-03"),
                transaction_type: TransactionType.Withdraw,
                amount: 500,
                classification: Classification.Needs,
            });

            const notifications = service.getNotifications(new Date(Date.UTC(2024, 0, 8)));
            expect(
                notifications.some((n) => n.kind === "credit_limit_approaching")
            ).toBe(false);
        });

        test("emits a payment-due alert when due date is near and balance is owed", () => {
            const card = createCreditAccount();
            service.upsertCreditCardDetails(card.account_id, {
                credit_limit: 1000,
                statement_day: 28,
                payment_due_day: 12,
            });
            transactionService.createTransaction({
                account_id: card.account_id,
                transaction_date: new Date("2024-01-03"),
                transaction_type: TransactionType.Withdraw,
                amount: 200,
                classification: Classification.Needs,
            });

            const notifications = service.getNotifications(new Date(Date.UTC(2024, 0, 8)));
            const due = notifications.find((n) => n.kind === "credit_payment_due");

            expect(due).toBeDefined();
            expect(due && due.kind === "credit_payment_due" && due.amount_due).toBe(200);
        });
    });
});
