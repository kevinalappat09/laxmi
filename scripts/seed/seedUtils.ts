/**
 * @module seedUtils
 * @description Shared helpers for Electron-based development profile seeding.
 * @stability internal
 */

import * as path from "path";
import { app } from "electron";
import * as profileService from "../../src/services/profile/profileService";
import { MigrationService } from "../../src/services/migration/migrationService";
import { profileSessionService } from "../../src/services/profileSession/profileSessionService";
import { CategoryServiceImpl } from "../../src/services/category/categoryService";
import { AccountServiceImpl } from "../../src/services/account/accountService";
import { BudgetServiceImpl } from "../../src/services/budget/budgetService";
import { CreditCardServiceImpl } from "../../src/services/creditCard/creditCardService";
import { PortfolioAssetServiceImpl } from "../../src/services/portfolio/portfolioAssetService";
import { RecurringTransactionServiceImpl } from "../../src/services/recurringTransaction/recurringTransactionService";
import { PriceUpdaterServiceImpl } from "../../src/services/priceUpdater/priceUpdaterService";
import { SQLiteDatabase } from "../../src/database/databaseService";
import { Classification, TransactionType } from "../../src/types/transaction";

export const PROFILE_NAMES = {
    txnBudget: "TxnBudgetDemo",
    assetsSip: "AssetsSipDemo",
    creditCard: "CreditCardDemo",
} as const;

export interface BulkTransactionRow {
    account_id: number;
    transaction_date: string;
    transaction_type: TransactionType;
    amount: number;
    category_id: number | null;
    classification: Classification;
    payee: string | null;
    note: string | null;
    transfer_account_id: number | null;
}

export function getMigrationsDir(): string {
    // Compiled: dist/scripts/seed → dist/src/migrations
    // ts-node from scripts/seed → src/migrations (same relative path)
    return path.join(__dirname, "../../src/migrations");
}

export function createServices() {
    return {
        migrationService: new MigrationService(getMigrationsDir()),
        accounts: new AccountServiceImpl(),
        categories: new CategoryServiceImpl(),
        budgets: new BudgetServiceImpl(),
        creditCards: new CreditCardServiceImpl(),
        portfolioAssets: new PortfolioAssetServiceImpl(),
        recurring: new RecurringTransactionServiceImpl(),
        prices: new PriceUpdaterServiceImpl(),
    };
}

export type SeedServices = ReturnType<typeof createServices>;

/**
 * Deletes an existing profile if present, creates it fresh, and opens a session.
 */
export async function recreateAndOpenProfile(
    profileName: string,
    migrationService: MigrationService
): Promise<SQLiteDatabase> {
    const existing = await profileService.listProfiles();
    if (existing.includes(profileName)) {
        console.log(`  Deleting existing profile "${profileName}"…`);
        profileSessionService.closeDatabaseConnection();
        await profileService.deleteProfile(profileName);
    }

    console.log(`  Creating profile "${profileName}"…`);
    await profileService.createProfile(profileName, migrationService);
    return profileService.openProfile(profileName, migrationService);
}

export function requireCategoryId(
    nameMap: Map<string, number>,
    name: string
): number {
    const id = nameMap.get(name.toLowerCase());
    if (id === undefined) {
        throw new Error(`Category not found: ${name}`);
    }
    return id;
}

export function bulkInsertTransactions(
    db: SQLiteDatabase,
    rows: BulkTransactionRow[]
): void {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
        INSERT INTO transactions (
            account_id, transaction_date, transaction_type, amount,
            category_id, classification, payee, note, transfer_account_id,
            is_active, created_on, modified_on
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    const insertMany = db.transaction((items: BulkTransactionRow[]) => {
        for (const row of items) {
            stmt.run(
                row.account_id,
                row.transaction_date,
                row.transaction_type,
                row.amount,
                row.category_id,
                row.classification,
                row.payee,
                row.note,
                row.transfer_account_id,
                now,
                now
            );
        }
    });

    insertMany(rows);
}

/** Deterministic PRNG (Mulberry32). */
export function createRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
    return items[Math.floor(rng() * items.length)]!;
}

export function randomAmount(
    rng: () => number,
    min: number,
    max: number,
    decimals = 0
): number {
    const value = min + rng() * (max - min);
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

export function toISODate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export function addDays(d: Date, days: number): Date {
    const next = new Date(d);
    next.setDate(next.getDate() + days);
    return next;
}

export function addMonths(d: Date, months: number): Date {
    const next = new Date(d);
    next.setMonth(next.getMonth() + months);
    return next;
}

export function startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function daysInMonth(year: number, monthIndex: number): number {
    return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Runs an async seed function with labeled logging.
 */
export async function runSeedStep(
    label: string,
    fn: () => Promise<void>
): Promise<void> {
    console.log(`\n=== ${label} ===`);
    try {
        await fn();
        console.log(`=== ${label} complete ===\n`);
    } catch (err) {
        console.error(`=== ${label} failed ===`);
        throw err;
    } finally {
        profileSessionService.closeDatabaseConnection();
    }
}

export async function quitElectron(exitCode = 0): Promise<void> {
    app.exit(exitCode);
}
