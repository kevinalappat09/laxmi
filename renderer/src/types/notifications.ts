import { RecurringFrequency } from "../../../src/types/recurringTransaction"
import { TransactionType } from "../../../src/types/transaction"

export type AppNotification =
  | {
      kind: 'budget_warning'
      budgetId: number
      name: string
      percentage: number
      periodLabel: string
      amount: number
      spent: number
    }
  | {
      kind: 'budget_over'
      budgetId: number
      name: string
      overBy: number
      periodLabel: string
      amount: number
      spent: number
    }
  | {
      kind: 'recurring_upcoming'
      recurringId: number
      name: string
      transactionType: TransactionType.Deposit | TransactionType.Withdraw
      amount: number
      daysUntilDue: number
      nextDueDate: Date
      frequency: RecurringFrequency
    }
  | {
      kind: 'credit_utilization'
      accountId: number
      name: string
      utilizationPercent: number
      targetPercent: number
      outstanding: number
      statementDate: Date
      daysUntilStatement: number
    }
  | {
      kind: 'credit_limit_approaching'
      accountId: number
      name: string
      utilizationPercent: number
      outstanding: number
      available: number
      creditLimit: number
    }
  | {
      kind: 'credit_payment_due'
      accountId: number
      name: string
      amountDue: number
      dueDate: Date
      daysUntilDue: number
    }
