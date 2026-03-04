/**
 * @module transactionService
 * @description Orchestrates transaction business logic and persistence operations.
 * @stability stable
 */

import {
    Transaction,
    TransactionType,
    Classification,
    CreateTransactionRequest,
    UpdateTransactionRequest,
    TransactionReportQuery,
    ReportRow,
} from "../../types/transaction";
import { TransactionRepositoryImpl } from "./transactionRepository";
import { AccountRepositoryImpl } from "../account/accountRepository";
import { CategoryRepositoryImpl } from "../category/categoryRepository";
import { profileSessionService } from "../profileSession/profileSessionService";

export interface TransactionService {
    createTransaction(request: CreateTransactionRequest): Transaction;
    updateTransaction(transactionId: number, request: UpdateTransactionRequest): Transaction;
    deleteTransaction(transactionId: number): void;
    getTransaction(transactionId: number): Transaction;
    getTransactionsByAccount(accountId: number): Transaction[];
    findWithFilter(query: TransactionReportQuery): Transaction[];
    aggregate(query: TransactionReportQuery): ReportRow[];
}


export class TransactionServiceImpl implements TransactionService {

    createTransaction(request: CreateTransactionRequest): Transaction {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        this.validateCreateRequest(request, db);

        const now = new Date();
        const transaction: Transaction = {
            account_id: request.account_id,
            transaction_date: request.transaction_date,
            transaction_type: request.transaction_type,
            amount: request.amount,
            category_id: request.category_id,
            classification: request.classification,
            note: request.note,
            transfer_account_id: request.transfer_account_id,
            is_active: true,
            created_on: now,
            modified_on: now,
        };

        const repository = new TransactionRepositoryImpl(db);
        return repository.save(transaction);
    }

    updateTransaction(transactionId: number, request: UpdateTransactionRequest): Transaction {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new TransactionRepositoryImpl(db);
        const existing = repository.findById(transactionId);

        if (!existing) {
            throw new Error(`Transaction with ID ${transactionId} not found.`);
        }

        this.validateUpdateRequest(request, existing, db);

        const updated: Transaction = {
            ...existing,
            transaction_date: request.transaction_date ?? existing.transaction_date,
            transaction_type: request.transaction_type ?? existing.transaction_type,
            amount: request.amount ?? existing.amount,
            category_id: request.category_id ?? existing.category_id,
            classification: request.classification ?? existing.classification,
            note: request.note ?? existing.note,
            transfer_account_id: request.transfer_account_id ?? existing.transfer_account_id,
            modified_on: new Date(),
        };

        return repository.save(updated);
    }

    deleteTransaction(transactionId: number): void {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new TransactionRepositoryImpl(db);
        const existing = repository.findById(transactionId);

        if (!existing) {
            throw new Error(`Transaction with ID ${transactionId} not found.`);
        }

        repository.delete(transactionId);
    }

    getTransaction(transactionId: number): Transaction {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new TransactionRepositoryImpl(db);
        const transaction = repository.findById(transactionId);

        if (!transaction) {
            throw new Error(`Transaction with ID ${transactionId} not found.`);
        }

        return transaction;
    }

    getTransactionsByAccount(accountId: number): Transaction[] {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new TransactionRepositoryImpl(db);
        return repository.findByAccountId(accountId);
    }

    findWithFilter(query: TransactionReportQuery): Transaction[] {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new TransactionRepositoryImpl(db);
        return repository.findWithFilter(query);
    }

    aggregate(query: TransactionReportQuery): ReportRow[] {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new TransactionRepositoryImpl(db);
        return repository.aggregate(query);
    }

    private validateCreateRequest(request: CreateTransactionRequest, db: any): void {
        if (!request.account_id) {
            throw new Error("account_id is required.");
        }
        if (!request.transaction_date) {
            throw new Error("transaction_date is required.");
        }
        if (!request.transaction_type) {
            throw new Error("transaction_type is required.");
        }
        if (request.amount === undefined || request.amount === null) {
            throw new Error("amount is required.");
        }
        if (request.amount <= 0) {
            throw new Error("amount must be greater than 0.");
        }
        if (!request.classification) {
            throw new Error("classification is required.");
        }

        this.validateAccountExists(request.account_id, db);

        if (request.category_id !== undefined && request.category_id !== null) {
            this.validateCategoryExists(request.category_id, db);
        }

        if (request.transfer_account_id !== undefined && request.transfer_account_id !== null) {
            if (request.transfer_account_id === request.account_id) {
                throw new Error("transfer_account_id cannot be the same as account_id.");
            }
            this.validateAccountExists(request.transfer_account_id, db);
        }
    }

    private validateUpdateRequest(
        request: UpdateTransactionRequest,
        existing: Transaction,
        db: any
    ): void {
        if (request.amount !== undefined && request.amount !== null && request.amount <= 0) {
            throw new Error("amount must be greater than 0.");
        }

        if (request.category_id !== undefined && request.category_id !== null) {
            this.validateCategoryExists(request.category_id, db);
        }

        if (request.transfer_account_id !== undefined && request.transfer_account_id !== null) {
            const accountId = request.transfer_account_id;
            if (accountId === existing.account_id) {
                throw new Error("transfer_account_id cannot be the same as account_id.");
            }
            this.validateAccountExists(accountId, db);
        }
    }

    private validateAccountExists(accountId: number, db: any): void {
        const accountRepository = new AccountRepositoryImpl(db);
        const account = accountRepository.findById(accountId);
        if (!account) {
            throw new Error(`Account with ID ${accountId} does not exist.`);
        }
    }

    private validateCategoryExists(categoryId: number, db: any): void {
        const categoryRepository = new CategoryRepositoryImpl(db);
        const category = categoryRepository.findById(categoryId);
        if (!category) {
            throw new Error(`Category with ID ${categoryId} does not exist.`);
        }
    }
}
