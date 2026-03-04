/**
 * @module accountService
 * @description Orchestrates account business logic and persistence operations.
 * @stability stable
 */

import { Account, AccountType, CreateAccountRequest, UpdateAccountRequest } from "../../types/account";
import { AccountRepositoryImpl } from "./accountRepository";
import { TransactionRepositoryImpl } from "../transaction/transactionRepository";
import { profileSessionService } from "../profileSession/profileSessionService";

/**
 * Service interface for Account operations.
 */
export interface AccountService {
    createAccount(request: CreateAccountRequest): Account;
    updateAccount(accountId: number, request: UpdateAccountRequest): Account;
    deactivateAccount(accountId: number): void;
    getAccount(accountId: number): Account;
    listActiveAccounts(): Account[];
}

/**
 * Account service implementation.
 */
export class AccountServiceImpl implements AccountService {
    /**
     * Creates a new account.
     */
    createAccount(request: CreateAccountRequest): Account {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        this.validateColor(request.color);

        const now = new Date();
        const account: Account = {
            account_id: 0,
            institution_name: request.institution_name,
            account_name: request.account_name,
            account_type: request.account_type,
            sub_type: request.sub_type,
            color: request.color,
            opened_on: request.opened_on,
            created_on: now,
            modified_on: now,
            is_active: true,
        };

        const repository = new AccountRepositoryImpl(db);
        return repository.save(account);
    }

    /**
     * Updates an existing account.
     */
    updateAccount(accountId: number, request: UpdateAccountRequest): Account {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        if (request.color) {
            this.validateColor(request.color);
        }

        const repository = new AccountRepositoryImpl(db);
        const existing = repository.findById(accountId);

        if (!existing) {
            throw new Error(`Account with ID ${accountId} not found.`);
        }

        const updated: Account = {
            ...existing,
            institution_name: request.institution_name ?? existing.institution_name,
            account_name: request.account_name ?? existing.account_name,
            account_type: request.account_type ?? existing.account_type,
            sub_type: request.sub_type ?? existing.sub_type,
            color: request.color ?? existing.color,
            opened_on: request.opened_on ?? existing.opened_on,
            modified_on: new Date(),
            is_active: request.is_active ?? existing.is_active,
        };

        return repository.save(updated);
    }

    /**
     * Deactivates an account and its associated transactions.
     */
    deactivateAccount(accountId: number): void {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new AccountRepositoryImpl(db);
        const existing = repository.findById(accountId);

        if (!existing) {
            throw new Error(`Account with ID ${accountId} not found.`);
        }

        const transactionRepository = new TransactionRepositoryImpl(db);
        transactionRepository.deleteByAccountId(accountId);
        repository.deactivate(accountId);
    }

    /**
     * Retrieves a single account by ID.
     */
    getAccount(accountId: number): Account {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new AccountRepositoryImpl(db);
        const account = repository.findById(accountId);

        if (!account) {
            throw new Error(`Account with ID ${accountId} not found.`);
        }

        return account;
    }

    /**
     * Lists all active accounts.
     */
    listActiveAccounts(): Account[] {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new AccountRepositoryImpl(db);
        return repository.findAllActive();
    }

    /**
     * Validates hex color format.
     */
    private validateColor(color: string): void {
        const hexColorPattern = /^#[0-9A-Fa-f]{6}$/;
        if (!hexColorPattern.test(color)) {
            throw new Error(`Invalid color format. Expected hex color like #FF5733, got: ${color}`);
        }
    }
}
