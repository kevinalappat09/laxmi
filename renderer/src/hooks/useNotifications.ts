import { useEffect, useState } from 'react'
import { BudgetStatus } from '../../../src/types/budget'
import type { BudgetWithSpending } from '../../../src/types/budget'
import type { RecurringUpcomingNotification } from '../../../src/types/recurringTransaction'
import type { AppNotification } from '../types/notifications'

interface UseNotificationsResult {
  notifications: AppNotification[]
  isLoading: boolean
  error: string | null
}

function sortNotifications(notifications: AppNotification[]): AppNotification[] {
  const kindRank: Record<AppNotification['kind'], number> = {
    budget_over: 0,
    budget_warning: 1,
    recurring_upcoming: 2,
  }

  return [...notifications].sort((left, right) => {
    const rankDiff = kindRank[left.kind] - kindRank[right.kind]
    if (rankDiff !== 0) return rankDiff

    if (left.kind === 'recurring_upcoming' && right.kind === 'recurring_upcoming') {
      if (left.daysUntilDue !== right.daysUntilDue) {
        return left.daysUntilDue - right.daysUntilDue
      }
      return left.amount - right.amount
    }

    if (left.kind === 'budget_over' && right.kind === 'budget_over') {
      return right.overBy - left.overBy
    }

    if (left.kind === 'budget_warning' && right.kind === 'budget_warning') {
      return right.percentage - left.percentage
    }

    return 0
  })
}

function mapBudgetNotification(budget: BudgetWithSpending): AppNotification | null {
  if (!budget.budget_id) return null

  if (budget.status === BudgetStatus.OverBudget) {
    return {
      kind: 'budget_over',
      budgetId: budget.budget_id,
      name: budget.name,
      overBy: Math.max(budget.spent - budget.amount, 0),
      periodLabel: budget.period_label,
      amount: budget.amount,
      spent: budget.spent,
    }
  }

  if (budget.status === BudgetStatus.Warning) {
    return {
      kind: 'budget_warning',
      budgetId: budget.budget_id,
      name: budget.name,
      percentage: budget.percentage,
      periodLabel: budget.period_label,
      amount: budget.amount,
      spent: budget.spent,
    }
  }

  return null
}

function mapRecurringNotification(recurringRow: RecurringUpcomingNotification): AppNotification | null {
  const recurringId = recurringRow.recurring.recurring_id
  if (!recurringId) return null

  return {
    kind: 'recurring_upcoming',
    recurringId,
    name:
      recurringRow.recurring.payee ||
      recurringRow.recurring.note ||
      `Recurring #${recurringId}`,
    transactionType: recurringRow.recurring.transaction_type,
    amount: recurringRow.recurring.amount,
    daysUntilDue: recurringRow.days_until_due,
    nextDueDate: recurringRow.next_due_date,
    frequency: recurringRow.recurring.frequency,
  }
}

export function useNotifications(daysAhead = 10): UseNotificationsResult {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadNotifications() {
      setIsLoading(true)
      setError(null)

      const [budgetResult, recurringResult] = await Promise.allSettled([
        window.financeAPI.getBudgetNotifications(),
        window.financeAPI.getUpcomingRecurring(daysAhead),
      ])
      if (!isMounted) return

      const nextNotifications: AppNotification[] = []
      let nextError: string | null = null

      if (budgetResult.status === 'fulfilled') {
        nextNotifications.push(
          ...budgetResult.value
            .map((budget) => mapBudgetNotification(budget))
            .filter((item): item is AppNotification => item !== null)
        )
      } else {
        console.error(budgetResult.reason)
        nextError = 'Some alerts could not be loaded.'
      }

      if (recurringResult.status === 'fulfilled') {
        nextNotifications.push(
          ...recurringResult.value
            .map((row) => mapRecurringNotification(row))
            .filter((item): item is AppNotification => item !== null)
        )
      } else {
        console.error(recurringResult.reason)
        nextError = 'Some alerts could not be loaded.'
      }

      setNotifications(sortNotifications(nextNotifications))
      setError(nextError)
      setIsLoading(false)
    }

    loadNotifications().catch((err) => {
      console.error(err)
      if (!isMounted) return
      setNotifications([])
      setError('Failed to load alerts.')
      setIsLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [daysAhead])

  return { notifications, isLoading, error }
}
