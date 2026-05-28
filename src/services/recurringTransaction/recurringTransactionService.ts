/**
 * @module recurringTransactionService
 * @description Orchestrates recurring transaction business logic and materialization.
 * @stability stable
 */

import { AccountRepositoryImpl } from "../../repository/account/accountRepository";
import { CategoryRepositoryImpl } from "../../repository/category/categoryRepository";
import {
    RecurringTransactionRepositoryImpl,
} from "../../repository/recurringTransaction/recurringTransactionRepository";
import {
    CreateRecurringTransactionRequest,
    RecurringFrequency,
    RecurringUpcomingNotification,
    RecurringTransaction,
    UpdateRecurringTransactionRequest,
} from "../../types/recurringTransaction";
import { profileSessionService } from "../profileSession/profileSessionService";
import { TransactionServiceImpl } from "../transaction/transactionService";

export interface RecurringTransactionService {
    createRecurringTransaction(
        request: CreateRecurringTransactionRequest
    ): RecurringTransaction;
    updateRecurringTransaction(
        recurringId: number,
        request: UpdateRecurringTransactionRequest
    ): RecurringTransaction;
    deactivateRecurringTransaction(recurringId: number): void;
    listRecurringTransactions(): RecurringTransaction[];
    getUpcomingNotifications(daysAhead?: number): RecurringUpcomingNotification[];
    processRecurringTransactions(referenceDate?: Date): number;
}

type RecurrenceFields = {
    day_of_week?: number;
    day_of_month?: number;
    month_of_year?: number;
};

export class RecurringTransactionServiceImpl
    implements RecurringTransactionService
{
    private transactionService = new TransactionServiceImpl();

    createRecurringTransaction(
        request: CreateRecurringTransactionRequest
    ): RecurringTransaction {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        this.validateCreateRequest(request, db);

        const now = new Date();
        const recurrence = this.resolveRecurrenceFields(
            request.frequency,
            request.day_of_week,
            request.day_of_month,
            request.month_of_year
        );

        const recurringTransaction: RecurringTransaction = {
            account_id: request.account_id,
            transaction_type: request.transaction_type,
            amount: request.amount,
            category_id: request.category_id,
            classification: request.classification,
            payee: request.payee?.trim() || undefined,
            note: request.note?.trim() || undefined,
            frequency: request.frequency,
            ...recurrence,
            start_date: request.start_date,
            is_active: true,
            created_on: now,
            modified_on: now,
        };

        const repository = new RecurringTransactionRepositoryImpl(db);
        return repository.save(recurringTransaction);
    }

    updateRecurringTransaction(
        recurringId: number,
        request: UpdateRecurringTransactionRequest
    ): RecurringTransaction {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new RecurringTransactionRepositoryImpl(db);
        const existing = repository.findById(recurringId);
        if (!existing) {
            throw new Error(`Recurring transaction with ID ${recurringId} not found.`);
        }

        this.validateUpdateRequest(request, db);

        const resolvedFrequency = request.frequency ?? existing.frequency;
        const recurrence = this.resolveRecurrenceFields(
            resolvedFrequency,
            resolvedFrequency === RecurringFrequency.Weekly
                ? (request.day_of_week ?? existing.day_of_week)
                : undefined,
            resolvedFrequency === RecurringFrequency.Monthly ||
                resolvedFrequency === RecurringFrequency.Yearly
                ? (request.day_of_month ?? existing.day_of_month)
                : undefined,
            resolvedFrequency === RecurringFrequency.Yearly
                ? (request.month_of_year ?? existing.month_of_year)
                : undefined
        );

        const updated: RecurringTransaction = {
            ...existing,
            account_id: request.account_id ?? existing.account_id,
            transaction_type: request.transaction_type ?? existing.transaction_type,
            amount: request.amount ?? existing.amount,
            category_id:
                request.category_id !== undefined
                    ? request.category_id
                    : existing.category_id,
            classification: request.classification ?? existing.classification,
            payee:
                request.payee !== undefined
                    ? request.payee.trim() || undefined
                    : existing.payee,
            note:
                request.note !== undefined
                    ? request.note.trim() || undefined
                    : existing.note,
            frequency: resolvedFrequency,
            ...recurrence,
            start_date: request.start_date ?? existing.start_date,
            is_active: request.is_active ?? existing.is_active,
            modified_on: new Date(),
        };

        this.validateEntity(updated, db);
        return repository.save(updated);
    }

    deactivateRecurringTransaction(recurringId: number): void {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new RecurringTransactionRepositoryImpl(db);
        const existing = repository.findById(recurringId);
        if (!existing) {
            throw new Error(`Recurring transaction with ID ${recurringId} not found.`);
        }

        repository.deactivate(recurringId);
    }

    listRecurringTransactions(): RecurringTransaction[] {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new RecurringTransactionRepositoryImpl(db);
        return repository.findAllActive();
    }

    getUpcomingNotifications(daysAhead: number = 10): RecurringUpcomingNotification[] {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const normalizedDaysAhead = Number.isFinite(daysAhead)
            ? Math.max(0, Math.floor(daysAhead))
            : 10;
        const repository = new RecurringTransactionRepositoryImpl(db);
        const recurringTransactions = repository.findAllActive();
        const today = this.toDateOnly(new Date());
        const fromDate = this.addDays(today, -1);
        const toDate = this.addDays(today, normalizedDaysAhead);
        const upcoming: RecurringUpcomingNotification[] = [];

        for (const recurring of recurringTransactions) {
            const startDate = this.toDateOnly(recurring.start_date);
            const effectiveFromDate =
                startDate.getTime() > fromDate.getTime()
                    ? this.addDays(startDate, -1)
                    : fromDate;
            const dueDates = this.computeDueDates(recurring, effectiveFromDate, toDate);
            if (dueDates.length === 0) {
                continue;
            }

            const nextDueDate = dueDates[0];
            const millisecondsDiff = nextDueDate.getTime() - today.getTime();
            const daysUntilDue = Math.floor(millisecondsDiff / 86_400_000);

            upcoming.push({
                recurring,
                next_due_date: nextDueDate,
                days_until_due: daysUntilDue,
            });
        }

        return upcoming.sort((a, b) => {
            if (a.days_until_due !== b.days_until_due) {
                return a.days_until_due - b.days_until_due;
            }
            if (a.next_due_date.getTime() !== b.next_due_date.getTime()) {
                return a.next_due_date.getTime() - b.next_due_date.getTime();
            }
            return (a.recurring.recurring_id ?? 0) - (b.recurring.recurring_id ?? 0);
        });
    }

    processRecurringTransactions(referenceDate: Date = new Date()): number {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const repository = new RecurringTransactionRepositoryImpl(db);
        const recurringTransactions = repository.findAllActive();
        const processingCutoff = this.addDays(
            this.toDateOnly(referenceDate),
            -1
        );
        let createdCount = 0;

        for (const recurring of recurringTransactions) {
            const startDate = this.toDateOnly(recurring.start_date);
            if (startDate.getTime() > processingCutoff.getTime()) {
                continue;
            }

            const fromDate = recurring.last_processed_date
                ? this.toDateOnly(recurring.last_processed_date)
                : this.addDays(startDate, -1);

            const dueDates = this.computeDueDates(
                recurring,
                fromDate,
                processingCutoff
            );

            for (const dueDate of dueDates) {
                this.transactionService.createTransaction({
                    account_id: recurring.account_id,
                    transaction_date: dueDate,
                    transaction_type: recurring.transaction_type,
                    amount: recurring.amount,
                    category_id: recurring.category_id,
                    classification: recurring.classification,
                    payee: recurring.payee,
                    note: recurring.note,
                });
            }

            if (dueDates.length > 0 && recurring.recurring_id) {
                repository.updateLastProcessedDate(
                    recurring.recurring_id,
                    dueDates[dueDates.length - 1]
                );
                createdCount += dueDates.length;
            }
        }

        return createdCount;
    }

    private computeDueDates(
        recurring: RecurringTransaction,
        fromDate: Date,
        toDate: Date
    ): Date[] {
        if (toDate.getTime() <= fromDate.getTime()) {
            return [];
        }

        if (recurring.frequency === RecurringFrequency.Weekly) {
            return this.computeWeeklyDueDates(
                recurring.day_of_week!,
                fromDate,
                toDate
            );
        }

        if (recurring.frequency === RecurringFrequency.Monthly) {
            return this.computeMonthlyDueDates(
                recurring.day_of_month!,
                fromDate,
                toDate
            );
        }

        return this.computeYearlyDueDates(
            recurring.day_of_month!,
            recurring.month_of_year!,
            fromDate,
            toDate
        );
    }

    private computeWeeklyDueDates(
        dayOfWeek: number,
        fromDate: Date,
        toDate: Date
    ): Date[] {
        const dueDates: Date[] = [];
        let cursor = this.addDays(fromDate, 1);

        while (cursor.getTime() <= toDate.getTime()) {
            if (cursor.getUTCDay() === dayOfWeek) {
                dueDates.push(cursor);
            }
            cursor = this.addDays(cursor, 1);
        }

        return dueDates;
    }

    private computeMonthlyDueDates(
        dayOfMonth: number,
        fromDate: Date,
        toDate: Date
    ): Date[] {
        const dueDates: Date[] = [];
        let year = fromDate.getUTCFullYear();
        let month = fromDate.getUTCMonth();

        while (
            year < toDate.getUTCFullYear() ||
            (year === toDate.getUTCFullYear() && month <= toDate.getUTCMonth())
        ) {
            const candidate = this.createDateWithClampedDay(year, month, dayOfMonth);
            if (
                candidate.getTime() > fromDate.getTime() &&
                candidate.getTime() <= toDate.getTime()
            ) {
                dueDates.push(candidate);
            }

            month += 1;
            if (month > 11) {
                month = 0;
                year += 1;
            }
        }

        return dueDates;
    }

    private computeYearlyDueDates(
        dayOfMonth: number,
        monthOfYear: number,
        fromDate: Date,
        toDate: Date
    ): Date[] {
        const dueDates: Date[] = [];
        for (
            let year = fromDate.getUTCFullYear();
            year <= toDate.getUTCFullYear();
            year += 1
        ) {
            const candidate = this.createDateWithClampedDay(
                year,
                monthOfYear - 1,
                dayOfMonth
            );
            if (
                candidate.getTime() > fromDate.getTime() &&
                candidate.getTime() <= toDate.getTime()
            ) {
                dueDates.push(candidate);
            }
        }

        return dueDates;
    }

    private createDateWithClampedDay(
        year: number,
        monthZeroBased: number,
        dayOfMonth: number
    ): Date {
        const maxDay = new Date(Date.UTC(year, monthZeroBased + 1, 0)).getUTCDate();
        const clampedDay = Math.min(dayOfMonth, maxDay);
        return new Date(Date.UTC(year, monthZeroBased, clampedDay));
    }

    private validateCreateRequest(
        request: CreateRecurringTransactionRequest,
        db: any
    ): void {
        if (!request.account_id) {
            throw new Error("account_id is required.");
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
        if (!request.frequency) {
            throw new Error("frequency is required.");
        }
        if (!request.start_date) {
            throw new Error("start_date is required.");
        }

        this.resolveRecurrenceFields(
            request.frequency,
            request.day_of_week,
            request.day_of_month,
            request.month_of_year
        );

        this.validateAccountExists(request.account_id, db);
        if (request.category_id !== undefined && request.category_id !== null) {
            this.validateCategoryExists(request.category_id, db);
        }
    }

    private validateUpdateRequest(
        request: UpdateRecurringTransactionRequest,
        db: any
    ): void {
        if (request.amount !== undefined && request.amount !== null && request.amount <= 0) {
            throw new Error("amount must be greater than 0.");
        }

        if (request.account_id !== undefined && request.account_id !== null) {
            this.validateAccountExists(request.account_id, db);
        }

        if (request.category_id !== undefined && request.category_id !== null) {
            this.validateCategoryExists(request.category_id, db);
        }
    }

    private validateEntity(entity: RecurringTransaction, db: any): void {
        if (entity.amount <= 0) {
            throw new Error("amount must be greater than 0.");
        }
        if (!entity.start_date) {
            throw new Error("start_date is required.");
        }

        this.validateAccountExists(entity.account_id, db);
        if (entity.category_id !== undefined && entity.category_id !== null) {
            this.validateCategoryExists(entity.category_id, db);
        }
    }

    private resolveRecurrenceFields(
        frequency: RecurringFrequency,
        dayOfWeek?: number,
        dayOfMonth?: number,
        monthOfYear?: number
    ): RecurrenceFields {
        if (frequency === RecurringFrequency.Weekly) {
            if (dayOfWeek === undefined || dayOfWeek === null) {
                throw new Error("day_of_week is required for weekly recurrence.");
            }
            if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
                throw new Error("day_of_week must be an integer between 0 and 6.");
            }
            return { day_of_week: dayOfWeek };
        }

        if (frequency === RecurringFrequency.Monthly) {
            if (dayOfMonth === undefined || dayOfMonth === null) {
                throw new Error("day_of_month is required for monthly recurrence.");
            }
            if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
                throw new Error("day_of_month must be an integer between 1 and 31.");
            }
            return { day_of_month: dayOfMonth };
        }

        if (frequency === RecurringFrequency.Yearly) {
            if (dayOfMonth === undefined || dayOfMonth === null) {
                throw new Error("day_of_month is required for yearly recurrence.");
            }
            if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
                throw new Error("day_of_month must be an integer between 1 and 31.");
            }
            if (monthOfYear === undefined || monthOfYear === null) {
                throw new Error("month_of_year is required for yearly recurrence.");
            }
            if (!Number.isInteger(monthOfYear) || monthOfYear < 1 || monthOfYear > 12) {
                throw new Error("month_of_year must be an integer between 1 and 12.");
            }
            return {
                day_of_month: dayOfMonth,
                month_of_year: monthOfYear,
            };
        }

        throw new Error(`Unsupported frequency: ${String(frequency)}`);
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

    private addDays(date: Date, days: number): Date {
        const next = new Date(date);
        next.setUTCDate(next.getUTCDate() + days);
        return next;
    }

    private toDateOnly(date: Date): Date {
        return new Date(
            Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
        );
    }
}
