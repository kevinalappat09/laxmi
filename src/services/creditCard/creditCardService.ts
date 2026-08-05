/**
 * @module creditCardService
 * @description Orchestrates credit card detail persistence, utilization summaries, and reminders.
 * @stability experimental
 */

import { AccountRepositoryImpl } from "../../repository/account/accountRepository";
import { CreditCardRepositoryImpl } from "../../repository/creditCard/creditCardRepository";
import { TransactionRepositoryImpl } from "../../repository/transaction/transactionRepository";
import { AccountSubType } from "../../types/account";
import {
    CreateCreditCardRequest,
    CreditCardDetails,
    CreditCardNotification,
    CreditCardSummary,
    UpdateCreditCardRequest,
} from "../../types/creditCard";
import { profileSessionService } from "../profileSession/profileSessionService";
import { computeAccountBalance } from "../../utils/balanceUtils";
import { daysBetween, nextDayOfMonthOnOrAfter } from "../../utils/dateUtils";

/**
 * Utilization at or above this fraction of the credit limit triggers a
 * standalone "approaching limit" alert, independent of the statement cycle.
 */
export const LIMIT_APPROACHING_THRESHOLD = 0.9;

/** Default utilization target users are nudged to stay under (5%). */
export const DEFAULT_UTILIZATION_ALERT_THRESHOLD = 0.05;

export interface CreditCardService {
    upsertCreditCardDetails(
        accountId: number,
        request: CreateCreditCardRequest | UpdateCreditCardRequest
    ): CreditCardDetails;
    getCreditCardDetails(accountId: number): CreditCardDetails | null;
    listCreditCardSummaries(referenceDate?: Date): CreditCardSummary[];
    getNotifications(referenceDate?: Date): CreditCardNotification[];
}

export class CreditCardServiceImpl implements CreditCardService {
    upsertCreditCardDetails(
        accountId: number,
        request: CreateCreditCardRequest | UpdateCreditCardRequest
    ): CreditCardDetails {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const accountRepository = new AccountRepositoryImpl(db);
        const account = accountRepository.findById(accountId);
        if (!account) {
            throw new Error(`Account with ID ${accountId} does not exist.`);
        }
        if (account.sub_type !== AccountSubType.Credit) {
            throw new Error("Credit card details can only be set on a credit account.");
        }

        const repository = new CreditCardRepositoryImpl(db);
        const existing = repository.findByAccountId(accountId);

        const merged: CreditCardDetails = {
            account_id: accountId,
            credit_limit: request.credit_limit ?? existing?.credit_limit ?? 0,
            statement_day: request.statement_day ?? existing?.statement_day ?? 1,
            payment_due_day: request.payment_due_day ?? existing?.payment_due_day ?? 1,
            utilization_alert_threshold:
                request.utilization_alert_threshold ??
                existing?.utilization_alert_threshold ??
                DEFAULT_UTILIZATION_ALERT_THRESHOLD,
            statement_reminder_lead_days:
                request.statement_reminder_lead_days ??
                existing?.statement_reminder_lead_days ??
                5,
            payment_reminder_lead_days:
                request.payment_reminder_lead_days ??
                existing?.payment_reminder_lead_days ??
                5,
            created_on: existing?.created_on ?? new Date(),
            modified_on: new Date(),
        };

        this.validate(merged);

        return repository.upsert(merged);
    }

    getCreditCardDetails(accountId: number): CreditCardDetails | null {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        return new CreditCardRepositoryImpl(db).findByAccountId(accountId);
    }

    listCreditCardSummaries(referenceDate: Date = new Date()): CreditCardSummary[] {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) {
            throw new Error("No active database connection. Open a profile first.");
        }

        const creditRepository = new CreditCardRepositoryImpl(db);
        const accountRepository = new AccountRepositoryImpl(db);
        const transactionRepository = new TransactionRepositoryImpl(db);

        const allDetails = creditRepository.findAllActive();
        const summaries: CreditCardSummary[] = [];

        for (const details of allDetails) {
            const account = accountRepository.findById(details.account_id);
            if (!account || !account.is_active) {
                continue;
            }

            const transactions = transactionRepository.findAffectingAccount(
                details.account_id
            );
            const balance = computeAccountBalance(transactions, details.account_id);
            const outstanding = Math.max(0, -balance);
            const available = details.credit_limit - outstanding;
            const utilization =
                details.credit_limit > 0 ? outstanding / details.credit_limit : 0;

            summaries.push({
                account,
                details,
                outstanding,
                available,
                utilization,
                next_statement_date: nextDayOfMonthOnOrAfter(
                    referenceDate,
                    details.statement_day
                ),
                next_due_date: nextDayOfMonthOnOrAfter(
                    referenceDate,
                    details.payment_due_day
                ),
            });
        }

        return summaries;
    }

    getNotifications(referenceDate: Date = new Date()): CreditCardNotification[] {
        const summaries = this.listCreditCardSummaries(referenceDate);
        const notifications: CreditCardNotification[] = [];

        for (const summary of summaries) {
            const daysUntilStatement = daysBetween(
                referenceDate,
                summary.next_statement_date
            );
            const daysUntilDue = daysBetween(referenceDate, summary.next_due_date);

            if (summary.utilization >= LIMIT_APPROACHING_THRESHOLD) {
                notifications.push({
                    kind: "credit_limit_approaching",
                    account_id: summary.account.account_id,
                    account_name: summary.account.account_name,
                    utilization: summary.utilization,
                    outstanding: summary.outstanding,
                    available: summary.available,
                    credit_limit: summary.details.credit_limit,
                });
            }

            if (
                daysUntilStatement <= summary.details.statement_reminder_lead_days &&
                summary.utilization > summary.details.utilization_alert_threshold
            ) {
                notifications.push({
                    kind: "credit_utilization",
                    account_id: summary.account.account_id,
                    account_name: summary.account.account_name,
                    utilization: summary.utilization,
                    target: summary.details.utilization_alert_threshold,
                    outstanding: summary.outstanding,
                    statement_date: summary.next_statement_date,
                    days_until_statement: daysUntilStatement,
                });
            }

            if (
                daysUntilDue <= summary.details.payment_reminder_lead_days &&
                summary.outstanding > 0
            ) {
                notifications.push({
                    kind: "credit_payment_due",
                    account_id: summary.account.account_id,
                    account_name: summary.account.account_name,
                    amount_due: summary.outstanding,
                    due_date: summary.next_due_date,
                    days_until_due: daysUntilDue,
                });
            }
        }

        return notifications;
    }

    private validate(details: CreditCardDetails): void {
        if (!(details.credit_limit > 0)) {
            throw new Error("credit_limit must be greater than 0.");
        }
        if (!this.isValidDayOfMonth(details.statement_day)) {
            throw new Error("statement_day must be an integer between 1 and 31.");
        }
        if (!this.isValidDayOfMonth(details.payment_due_day)) {
            throw new Error("payment_due_day must be an integer between 1 and 31.");
        }
        if (
            details.utilization_alert_threshold <= 0 ||
            details.utilization_alert_threshold > 1
        ) {
            throw new Error(
                "utilization_alert_threshold must be greater than 0 and at most 1."
            );
        }
        if (details.statement_reminder_lead_days < 0) {
            throw new Error("statement_reminder_lead_days must be 0 or greater.");
        }
        if (details.payment_reminder_lead_days < 0) {
            throw new Error("payment_reminder_lead_days must be 0 or greater.");
        }
    }

    private isValidDayOfMonth(day: number): boolean {
        return Number.isInteger(day) && day >= 1 && day <= 31;
    }
}
