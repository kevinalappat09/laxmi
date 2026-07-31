/**
 * @module creditCard
 * @description Defines credit card detail types, summaries, reminder DTOs, and request payloads.
 * @stability experimental
 */

import type { Account } from "./account";

export interface CreditCardDetails {
    account_id: number;
    credit_limit: number;
    statement_day: number;
    payment_due_day: number;
    utilization_alert_threshold: number;
    statement_reminder_lead_days: number;
    payment_reminder_lead_days: number;
    created_on: Date;
    modified_on: Date;
}

export interface CreateCreditCardRequest {
    credit_limit: number;
    statement_day: number;
    payment_due_day: number;
    utilization_alert_threshold?: number;
    statement_reminder_lead_days?: number;
    payment_reminder_lead_days?: number;
}

export type UpdateCreditCardRequest = Partial<CreateCreditCardRequest>;

export interface CreditCardSummary {
    account: Account;
    details: CreditCardDetails;
    outstanding: number;
    available: number;
    utilization: number;
    next_statement_date: Date;
    next_due_date: Date;
}

export type CreditCardNotification =
    | {
          kind: "credit_utilization";
          account_id: number;
          account_name: string;
          utilization: number;
          target: number;
          outstanding: number;
          statement_date: Date;
          days_until_statement: number;
      }
    | {
          kind: "credit_payment_due";
          account_id: number;
          account_name: string;
          amount_due: number;
          due_date: Date;
          days_until_due: number;
      };
