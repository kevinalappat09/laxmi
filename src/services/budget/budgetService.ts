/**
 * @module budgetService
 * @description Orchestrates budget business logic and persistence operations.
 * @stability stable
 */

import { AccountRepositoryImpl } from "../../repository/account/accountRepository";
import { BudgetRepositoryImpl } from "../../repository/budget/budgetRepository";
import { CategoryRepositoryImpl } from "../../repository/category/categoryRepository";
import {
    Budget,
    BudgetWithSpending,
    CreateBudgetRequest,
    UpdateBudgetRequest,
} from "../../types/budget";
import { Classification, TransactionType } from "../../types/transaction";
import { profileSessionService } from "../profileSession/profileSessionService";

const BUDGET_TYPE = {
    OVERALL: "overall",
    ACCOUNT: "account",
    CATEGORY: "category",
    CLASSIFICATION: "classification",
} as const;

const BUDGET_PERIOD = {
    MONTHLY: "monthly",
    YEARLY: "yearly",
} as const;

const BUDGET_STATUS = {
    ON_TRACK: "on_track",
    WARNING: "warning",
    OVER_BUDGET: "over_budget",
} as const;

type BudgetPeriodValue = (typeof BUDGET_PERIOD)[keyof typeof BUDGET_PERIOD];

export interface BudgetService {
    createBudget(request: CreateBudgetRequest): Budget;
    updateBudget(budgetId: number, request: UpdateBudgetRequest): Budget;
    deactivateBudget(budgetId: number): void;
    getActiveBudgetsWithSpending(referenceDate?: Date): BudgetWithSpending[];
    getNotifications(referenceDate?: Date): BudgetWithSpending[];
}

export class BudgetServiceImpl implements BudgetService {
    createBudget(request: CreateBudgetRequest): Budget {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        this.validateName(request.name);
        this.validateAmount(request.amount);
        const warningThreshold = this.getValidatedWarningThreshold(request.warning_threshold);

        const scope = this.resolveScope(
            request.budget_type,
            request.account_id,
            request.category_id,
            request.classification
        );
        this.validateScopeReferences(scope, db);

        const now = new Date();
        const budget: Budget = {
            name: request.name.trim(),
            budget_type: request.budget_type,
            period: request.period,
            amount: request.amount,
            account_id: scope.account_id,
            category_id: scope.category_id,
            classification: scope.classification,
            warning_threshold: warningThreshold,
            is_active: true,
            created_on: now,
            modified_on: now,
        };

        const repository = new BudgetRepositoryImpl(db);
        return repository.save(budget);
    }

    updateBudget(budgetId: number, request: UpdateBudgetRequest): Budget {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new BudgetRepositoryImpl(db);
        const existing = repository.findById(budgetId);

        if (!existing) {
            throw new Error(`Budget with ID ${budgetId} not found.`);
        }

        const resolvedType = request.budget_type ?? existing.budget_type;
        const scope = this.resolveScope(
            resolvedType,
            resolvedType === BUDGET_TYPE.ACCOUNT
                ? (request.account_id ?? existing.account_id)
                : undefined,
            resolvedType === BUDGET_TYPE.CATEGORY
                ? (request.category_id ?? existing.category_id)
                : undefined,
            resolvedType === BUDGET_TYPE.CLASSIFICATION
                ? (request.classification ?? existing.classification)
                : undefined
        );
        this.validateScopeReferences(scope, db);

        if (request.name !== undefined) {
            this.validateName(request.name);
        }
        if (request.amount !== undefined) {
            this.validateAmount(request.amount);
        }

        const warningThreshold =
            request.warning_threshold !== undefined
                ? this.getValidatedWarningThreshold(request.warning_threshold)
                : existing.warning_threshold;

        const updated: Budget = {
            ...existing,
            name: request.name !== undefined ? request.name.trim() : existing.name,
            budget_type: resolvedType,
            period: request.period ?? existing.period,
            amount: request.amount ?? existing.amount,
            account_id: scope.account_id,
            category_id: scope.category_id,
            classification: scope.classification,
            warning_threshold: warningThreshold,
            is_active: request.is_active ?? existing.is_active,
            modified_on: new Date(),
        };

        return repository.save(updated);
    }

    deactivateBudget(budgetId: number): void {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new BudgetRepositoryImpl(db);
        const existing = repository.findById(budgetId);
        if (!existing) {
            throw new Error(`Budget with ID ${budgetId} not found.`);
        }

        repository.deactivate(budgetId);
    }

    getActiveBudgetsWithSpending(referenceDate: Date = new Date()): BudgetWithSpending[] {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const rows = db
            .prepare(`
                SELECT
                    b.*,
                    a.account_name AS account_name,
                    c.category_name AS category_name
                FROM budgets b
                LEFT JOIN accounts a ON a.account_id = b.account_id
                LEFT JOIN categories c ON c.category_id = b.category_id
                WHERE b.is_active = 1
                ORDER BY b.budget_id DESC
            `)
            .all() as any[];

        return rows.map((row) => {
            const budget: Budget = {
                budget_id: row.budget_id,
                name: row.name,
                budget_type: row.budget_type as Budget["budget_type"],
                period: row.period as Budget["period"],
                amount: row.amount,
                account_id: row.account_id ?? undefined,
                category_id: row.category_id ?? undefined,
                classification: (row.classification as Classification) ?? undefined,
                warning_threshold: row.warning_threshold,
                is_active: row.is_active === 1,
                created_on: new Date(row.created_on),
                modified_on: new Date(row.modified_on),
            };

            const spent = this.calculateSpentForBudget(budget, referenceDate, db);
            const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
            const status = this.resolveStatus(spent, budget.amount, budget.warning_threshold);

            return {
                ...budget,
                spent,
                percentage: Number(percentage.toFixed(2)),
                status,
                period_label: this.getPeriodLabel(budget.period, referenceDate),
                account_name: row.account_name ?? undefined,
                category_name: row.category_name ?? undefined,
            };
        });
    }

    getNotifications(referenceDate: Date = new Date()): BudgetWithSpending[] {
        return this.getActiveBudgetsWithSpending(referenceDate).filter(
            (budget) =>
                budget.status === BUDGET_STATUS.WARNING ||
                budget.status === BUDGET_STATUS.OVER_BUDGET
        );
    }

    private resolveScope(
        budgetType: Budget["budget_type"],
        accountId?: number,
        categoryId?: number,
        classification?: Classification
    ): {
        account_id?: number;
        category_id?: number;
        classification?: Classification;
    } {
        if (budgetType === BUDGET_TYPE.OVERALL) {
            return {};
        }

        if (budgetType === BUDGET_TYPE.ACCOUNT) {
            if (!accountId) {
                throw new Error("account_id is required for account budgets.");
            }
            return { account_id: accountId };
        }

        if (budgetType === BUDGET_TYPE.CATEGORY) {
            if (!categoryId) {
                throw new Error("category_id is required for category budgets.");
            }
            return { category_id: categoryId };
        }

        if (budgetType === BUDGET_TYPE.CLASSIFICATION) {
            if (!classification) {
                throw new Error(
                    "classification is required for classification budgets."
                );
            }
            if (!Object.values(Classification).includes(classification)) {
                throw new Error(`Unsupported classification value: ${classification}`);
            }
            return { classification };
        }

        throw new Error(`Unsupported budget type: ${budgetType}`);
    }

    private validateScopeReferences(
        scope: {
            account_id?: number;
            category_id?: number;
            classification?: Classification;
        },
        db: any
    ): void {
        if (scope.account_id !== undefined) {
            const accountRepository = new AccountRepositoryImpl(db);
            const account = accountRepository.findById(scope.account_id);
            if (!account) {
                throw new Error(`Account with ID ${scope.account_id} does not exist.`);
            }
        }

        if (scope.category_id !== undefined) {
            const categoryRepository = new CategoryRepositoryImpl(db);
            const category = categoryRepository.findById(scope.category_id);
            if (!category) {
                throw new Error(
                    `Category with ID ${scope.category_id} does not exist.`
                );
            }
        }
    }

    private validateName(name: string): void {
        if (!name || name.trim().length === 0) {
            throw new Error("name is required and cannot be empty.");
        }
    }

    private validateAmount(amount: number): void {
        if (amount === undefined || amount === null || Number.isNaN(amount)) {
            throw new Error("amount is required.");
        }
        if (amount <= 0) {
            throw new Error("amount must be greater than 0.");
        }
    }

    private getValidatedWarningThreshold(value?: number): number {
        const threshold = value ?? 0.8;
        if (Number.isNaN(threshold) || threshold <= 0 || threshold > 1) {
            throw new Error("warning_threshold must be greater than 0 and at most 1.");
        }
        return threshold;
    }

    private resolveStatus(
        spent: number,
        limit: number,
        warningThreshold: number
    ): BudgetWithSpending["status"] {
        const ratio = limit > 0 ? spent / limit : 0;
        if (ratio >= 1) {
            return BUDGET_STATUS.OVER_BUDGET as BudgetWithSpending["status"];
        }
        if (ratio >= warningThreshold) {
            return BUDGET_STATUS.WARNING as BudgetWithSpending["status"];
        }
        return BUDGET_STATUS.ON_TRACK as BudgetWithSpending["status"];
    }

    private getPeriodLabel(period: BudgetPeriodValue, referenceDate: Date): string {
        if (period === BUDGET_PERIOD.YEARLY) {
            return String(referenceDate.getFullYear());
        }
        return referenceDate.toLocaleString(undefined, {
            month: "long",
            year: "numeric",
        });
    }

    private calculateSpentForBudget(
        budget: Budget,
        referenceDate: Date,
        db: any
    ): number {
        let sql = `
            SELECT COALESCE(SUM(amount), 0) AS spent
            FROM transactions
            WHERE is_active = 1
              AND transaction_type = ?
        `;
        const params: any[] = [TransactionType.Withdraw];

        if (budget.period === BUDGET_PERIOD.MONTHLY) {
            sql +=
                " AND strftime('%Y-%m', transaction_date) = strftime('%Y-%m', ?)";
        } else {
            sql += " AND strftime('%Y', transaction_date) = strftime('%Y', ?)";
        }
        params.push(referenceDate.toISOString());

        if (budget.budget_type === BUDGET_TYPE.ACCOUNT && budget.account_id) {
            sql += " AND account_id = ?";
            params.push(budget.account_id);
        } else if (
            budget.budget_type === BUDGET_TYPE.CATEGORY &&
            budget.category_id
        ) {
            sql += " AND category_id = ?";
            params.push(budget.category_id);
        } else if (
            budget.budget_type === BUDGET_TYPE.CLASSIFICATION &&
            budget.classification
        ) {
            sql += " AND classification = ?";
            params.push(budget.classification);
        }

        const row = db.prepare(sql).get(...params) as { spent: number } | undefined;
        return row?.spent ?? 0;
    }
}
