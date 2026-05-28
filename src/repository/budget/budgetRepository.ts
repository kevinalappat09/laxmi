/**
 * @module budgetRepository
 * @description Provides direct database access for Budget entities.
 * @stability stable
 */

import { SQLiteDatabase } from "../../database/databaseService";
import { Budget, BudgetPeriod, BudgetType } from "../../types/budget";
import { Classification } from "../../types/transaction";

export interface BudgetRepository {
    save(budget: Budget): Budget;
    findById(budgetId: number): Budget | null;
    findAllActive(): Budget[];
    deactivate(budgetId: number): void;
}

export class BudgetRepositoryImpl implements BudgetRepository {
    constructor(private db: SQLiteDatabase) {}

    save(budget: Budget): Budget {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const {
            budget_id,
            name,
            budget_type,
            period,
            amount,
            account_id,
            category_id,
            classification,
            warning_threshold,
            is_active,
            created_on,
            modified_on,
        } = budget;

        const createdOnStr = this.dateToISOString(created_on, "timestamp");
        const modifiedOnStr = this.dateToISOString(modified_on, "timestamp");

        if (budget_id) {
            const stmt = this.db.prepare(`
                UPDATE budgets
                SET name = ?,
                    budget_type = ?,
                    period = ?,
                    amount = ?,
                    account_id = ?,
                    category_id = ?,
                    classification = ?,
                    warning_threshold = ?,
                    is_active = ?,
                    modified_on = ?
                WHERE budget_id = ?
            `);

            stmt.run(
                name,
                budget_type,
                period,
                amount,
                account_id ?? null,
                category_id ?? null,
                classification ?? null,
                warning_threshold,
                is_active ? 1 : 0,
                modifiedOnStr,
                budget_id
            );

            return budget;
        }

        const stmt = this.db.prepare(`
            INSERT INTO budgets (
                name,
                budget_type,
                period,
                amount,
                account_id,
                category_id,
                classification,
                warning_threshold,
                is_active,
                created_on,
                modified_on
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            name,
            budget_type,
            period,
            amount,
            account_id ?? null,
            category_id ?? null,
            classification ?? null,
            warning_threshold,
            is_active ? 1 : 0,
            createdOnStr,
            modifiedOnStr
        );

        return {
            ...budget,
            budget_id: result.lastInsertRowid as number,
        };
    }

    findById(budgetId: number): Budget | null {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            SELECT * FROM budgets WHERE budget_id = ? AND is_active = 1
        `);

        const row = stmt.get(budgetId) as any;
        return row ? this.mapRowToBudget(row) : null;
    }

    findAllActive(): Budget[] {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            SELECT * FROM budgets WHERE is_active = 1 ORDER BY budget_id DESC
        `);

        const rows = stmt.all() as any[];
        return rows.map((row) => this.mapRowToBudget(row));
    }

    deactivate(budgetId: number): void {
        if (!this.db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const stmt = this.db.prepare(`
            UPDATE budgets
            SET is_active = 0, modified_on = ?
            WHERE budget_id = ?
        `);

        stmt.run(new Date().toISOString(), budgetId);
    }

    private mapRowToBudget(row: any): Budget {
        return {
            budget_id: row.budget_id,
            name: row.name,
            budget_type: row.budget_type as BudgetType,
            period: row.period as BudgetPeriod,
            amount: row.amount,
            account_id: row.account_id ?? undefined,
            category_id: row.category_id ?? undefined,
            classification: (row.classification as Classification) ?? undefined,
            warning_threshold: row.warning_threshold,
            is_active: row.is_active === 1,
            created_on: new Date(row.created_on),
            modified_on: new Date(row.modified_on),
        };
    }

    private dateToISOString(date: Date, format: "date" | "timestamp"): string {
        if (format === "date") {
            return date.toISOString().split("T")[0];
        }
        return date.toISOString();
    }
}
