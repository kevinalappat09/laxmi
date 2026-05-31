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

function getTypeLabel(notification: AppNotification): string {
  if (notification.kind === 'budget_over') return 'Budget Over'
  if (notification.kind === 'budget_warning') return 'Budget Warning'
  return notification.transactionType === TransactionType.Deposit
    ? 'Upcoming Income'
    : 'Upcoming Expense'
}

function getDetailText(notification: AppNotification): string {
  if (notification.kind === 'budget_over') {
    return `Over by ${formatCurrency(notification.overBy)} - ${notification.periodLabel}`
  }

  if (notification.kind === 'budget_warning') {
    return `${notification.percentage.toFixed(1)}% used - ${notification.periodLabel}`
  }

  if (notification.daysUntilDue === 0) {
    return `Due today - ${getFrequencyLabel(notification.frequency)}`
  }
  if (notification.daysUntilDue === 1) {
    return `Due tomorrow - ${getFrequencyLabel(notification.frequency)}`
  }

  return `Due in ${notification.daysUntilDue} days - ${formatDate(notification.nextDueDate)}`
}

function getRowClassName(notification: AppNotification): string {
  if (notification.kind === 'budget_over') return 'notifications-panel__row--budget-over'
  if (notification.kind === 'budget_warning') return 'notifications-panel__row--budget-warning'
  if (notification.daysUntilDue === 0) return 'notifications-panel__row--recurring-today'
  return 'notifications-panel__row--recurring-soon'
}

function getBadgeClassName(notification: AppNotification): string {
  if (notification.kind === 'budget_over') return 'notifications-panel__badge--budget-over'
  if (notification.kind === 'budget_warning') return 'notifications-panel__badge--budget-warning'
  if (notification.transactionType === TransactionType.Deposit) {
    return 'notifications-panel__badge--recurring-income'
  }
  return 'notifications-panel__badge--recurring-expense'
}

function getAmountValue(notification: AppNotification): number {
  if (notification.kind === 'budget_over') return notification.overBy
  if (notification.kind === 'budget_warning') return notification.amount
  return notification.amount
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
                  key={`${notification.kind}-${notification.kind === 'recurring_upcoming' ? notification.recurringId : notification.budgetId}`}
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
