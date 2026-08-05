import { RecurringFrequency } from '../../../../src/types/recurringTransaction'
import { TransactionType } from '../../../../src/types/transaction'
import type { AppNotification } from '../../types/notifications'
import { formatCurrency, formatDate } from '../../utils/formatters'
import './NotificationsPanel.css'

interface NotificationsPanelProps {
  notifications: AppNotification[]
  isLoading?: boolean
  error?: string | null
}

function getFrequencyLabel(frequency: RecurringFrequency): string {
  if (frequency === RecurringFrequency.Weekly) return 'Weekly'
  if (frequency === RecurringFrequency.Monthly) return 'Monthly'
  return 'Yearly'
}

function getDueLabel(daysUntilDue: number, nextDueDate: Date): string {
  if (daysUntilDue <= 0) return 'Due today'
  if (daysUntilDue === 1) return 'Due tomorrow'
  return `Due in ${daysUntilDue} days - ${formatDate(nextDueDate)}`
}

function getNotificationKey(notification: AppNotification): string {
  switch (notification.kind) {
    case 'budget_over':
    case 'budget_warning':
      return `${notification.kind}-${notification.budgetId}`
    case 'recurring_upcoming':
      return `${notification.kind}-${notification.recurringId}`
    case 'credit_utilization':
    case 'credit_limit_approaching':
    case 'credit_payment_due':
      return `${notification.kind}-${notification.accountId}`
  }
}

function getTypeLabel(notification: AppNotification): string {
  switch (notification.kind) {
    case 'budget_over':
      return 'Budget Over'
    case 'budget_warning':
      return 'Budget Warning'
    case 'recurring_upcoming':
      return notification.transactionType === TransactionType.Deposit
        ? 'Upcoming Income'
        : 'Upcoming Expense'
    case 'credit_utilization':
      return 'High Utilization'
    case 'credit_limit_approaching':
      return 'Limit Approaching'
    case 'credit_payment_due':
      return 'Payment Due'
  }
}

function getDetailText(notification: AppNotification): string {
  switch (notification.kind) {
    case 'budget_over':
      return `Over by ${formatCurrency(notification.overBy)} - ${notification.periodLabel}`
    case 'budget_warning':
      return `${notification.percentage.toFixed(1)}% used - ${notification.periodLabel}`
    case 'recurring_upcoming':
      return notification.daysUntilDue <= 1
        ? `${getDueLabel(notification.daysUntilDue, notification.nextDueDate)} - ${getFrequencyLabel(notification.frequency)}`
        : `Due in ${notification.daysUntilDue} days - ${formatDate(notification.nextDueDate)}`
    case 'credit_utilization':
      return `${notification.utilizationPercent.toFixed(1)}% used - reduce below ${notification.targetPercent.toFixed(0)}% before statement on ${formatDate(notification.statementDate)}`
    case 'credit_limit_approaching':
      return `${notification.utilizationPercent.toFixed(1)}% of limit used - only ${formatCurrency(notification.available)} available`
    case 'credit_payment_due':
      return `${getDueLabel(notification.daysUntilDue, notification.dueDate)}`
  }
}

function getRowClassName(notification: AppNotification): string {
  switch (notification.kind) {
    case 'budget_over':
      return 'notifications-panel__row--budget-over'
    case 'budget_warning':
      return 'notifications-panel__row--budget-warning'
    case 'recurring_upcoming':
      return notification.daysUntilDue <= 0
        ? 'notifications-panel__row--recurring-today'
        : 'notifications-panel__row--recurring-soon'
    case 'credit_utilization':
      return 'notifications-panel__row--budget-warning'
    case 'credit_limit_approaching':
      return 'notifications-panel__row--budget-over'
    case 'credit_payment_due':
      return notification.daysUntilDue <= 0
        ? 'notifications-panel__row--recurring-today'
        : 'notifications-panel__row--recurring-soon'
  }
}

function getBadgeClassName(notification: AppNotification): string {
  switch (notification.kind) {
    case 'budget_over':
      return 'notifications-panel__badge--budget-over'
    case 'budget_warning':
      return 'notifications-panel__badge--budget-warning'
    case 'recurring_upcoming':
      return notification.transactionType === TransactionType.Deposit
        ? 'notifications-panel__badge--recurring-income'
        : 'notifications-panel__badge--recurring-expense'
    case 'credit_utilization':
      return 'notifications-panel__badge--budget-warning'
    case 'credit_limit_approaching':
      return 'notifications-panel__badge--budget-over'
    case 'credit_payment_due':
      return 'notifications-panel__badge--recurring-expense'
  }
}

function getAmountValue(notification: AppNotification): number {
  switch (notification.kind) {
    case 'budget_over':
      return notification.overBy
    case 'budget_warning':
      return notification.amount
    case 'recurring_upcoming':
      return notification.amount
    case 'credit_utilization':
      return notification.outstanding
    case 'credit_limit_approaching':
      return notification.outstanding
    case 'credit_payment_due':
      return notification.amountDue
  }
}

function getAmountClassName(notification: AppNotification): string {
  if (notification.kind === 'recurring_upcoming' && notification.transactionType === TransactionType.Deposit) {
    return 'notifications-panel__amount notifications-panel__amount--income'
  }
  return 'notifications-panel__amount notifications-panel__amount--expense'
}

export function NotificationsPanel({ notifications, isLoading = false, error = null }: NotificationsPanelProps) {
  if (!isLoading && notifications.length === 0 && !error) {
    return null
  }

  return (
    <section className="notifications-panel" aria-live="polite">
      <div className="notifications-panel__header">
        <h2 className="notifications-panel__title">Alerts &amp; Upcoming</h2>
      </div>
      {error && <p className="notifications-panel__error">{error}</p>}
      {isLoading ? (
        <div className="notifications-panel__loading">Loading alerts...</div>
      ) : (
        <div className="notifications-panel__table-wrap">
          <table className="notifications-panel__table">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Name</th>
                <th scope="col">Detail</th>
                <th scope="col" className="notifications-panel__amount-head">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((notification) => (
                <tr
                  key={getNotificationKey(notification)}
                  className={`notifications-panel__row ${getRowClassName(notification)}`}
                >
                  <td>
                    <span
                      className={`notifications-panel__badge ${getBadgeClassName(notification)}`}
                    >
                      {getTypeLabel(notification)}
                    </span>
                  </td>
                  <td className="notifications-panel__name">{notification.name}</td>
                  <td className="notifications-panel__detail">{getDetailText(notification)}</td>
                  <td className={getAmountClassName(notification)}>
                    {formatCurrency(getAmountValue(notification))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
