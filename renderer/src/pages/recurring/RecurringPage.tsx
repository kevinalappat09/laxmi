import { useEffect, useMemo, useState } from 'react'
import type { Account } from '../../../../src/types/account'
import type { Category } from '../../../../src/types/category'
import {
  RecurringFrequency,
  type RecurringTransaction,
} from '../../../../src/types/recurringTransaction'
import { TransactionType } from '../../../../src/types/transaction'
import { RecurringDialog } from './RecurringDialog'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Tag } from '../../components/ui/Tag'
import { formatCurrency, formatDate } from '../../utils/formatters'
import './RecurringPage.css'

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function createCategoryPathMap(categories: Category[]): Map<number, string> {
  const byId = new Map<number, Category>()
  categories.forEach((category) => {
    if (category.category_id !== undefined) {
      byId.set(category.category_id, category)
    }
  })

  const cache = new Map<number, string>()
  const buildPath = (id: number): string => {
    const cached = cache.get(id)
    if (cached) return cached

    const category = byId.get(id)
    if (!category) return String(id)
    if (category.parent_category_id === undefined) {
      cache.set(id, category.category_name)
      return category.category_name
    }

    const parentPath = buildPath(category.parent_category_id)
    const path = `${parentPath} / ${category.category_name}`
    cache.set(id, path)
    return path
  }

  for (const id of byId.keys()) {
    buildPath(id)
  }

  return cache
}

function toDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function createDateWithClampedDay(year: number, monthIndex: number, day: number): Date {
  const maxDay = new Date(year, monthIndex + 1, 0).getDate()
  const clampedDay = Math.min(day, maxDay)
  return new Date(year, monthIndex, clampedDay)
}

function getNextDueDate(recurring: RecurringTransaction, fromDate: Date = new Date()): Date | null {
  const startDate = toDateOnly(new Date(recurring.start_date))
  const base = toDateOnly(fromDate)
  const cursor = startDate.getTime() > base.getTime() ? startDate : base

  if (recurring.frequency === RecurringFrequency.Weekly) {
    const dayOfWeek = recurring.day_of_week
    if (dayOfWeek === undefined) return null
    const result = new Date(cursor)
    const offset = (dayOfWeek - result.getDay() + 7) % 7
    result.setDate(result.getDate() + offset)
    return result
  }

  if (recurring.frequency === RecurringFrequency.Monthly) {
    if (!recurring.day_of_month) return null
    const candidate = createDateWithClampedDay(
      cursor.getFullYear(),
      cursor.getMonth(),
      recurring.day_of_month
    )
    if (candidate.getTime() >= cursor.getTime()) {
      return candidate
    }
    return createDateWithClampedDay(
      cursor.getMonth() === 11 ? cursor.getFullYear() + 1 : cursor.getFullYear(),
      cursor.getMonth() === 11 ? 0 : cursor.getMonth() + 1,
      recurring.day_of_month
    )
  }

  if (!recurring.day_of_month || !recurring.month_of_year) return null
  const thisYearCandidate = createDateWithClampedDay(
    cursor.getFullYear(),
    recurring.month_of_year - 1,
    recurring.day_of_month
  )
  if (thisYearCandidate.getTime() >= cursor.getTime()) {
    return thisYearCandidate
  }
  return createDateWithClampedDay(
    cursor.getFullYear() + 1,
    recurring.month_of_year - 1,
    recurring.day_of_month
  )
}

function getFrequencyLabel(recurring: RecurringTransaction): string {
  if (recurring.frequency === RecurringFrequency.Weekly) {
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(
      new Date(2026, 0, (recurring.day_of_week ?? 0) + 4)
    )
    return `Weekly on ${weekday}`
  }
  if (recurring.frequency === RecurringFrequency.Monthly) {
    return `Monthly on day ${recurring.day_of_month ?? '-'}`
  }
  const monthLabel = recurring.month_of_year
    ? new Intl.DateTimeFormat(undefined, { month: 'long' }).format(
        new Date(2026, recurring.month_of_year - 1, 1)
      )
    : '-'
  return `Yearly on ${monthLabel} ${recurring.day_of_month ?? '-'}`
}

export function RecurringPage() {
  const [recurringRows, setRecurringRows] = useState<RecurringTransaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null)
  const [selectedRecurring, setSelectedRecurring] = useState<RecurringTransaction | undefined>(
    undefined
  )

  const categoryPathMap = useMemo(() => createCategoryPathMap(categories), [categories])
  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.account_id, account.account_name])),
    [accounts]
  )

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [rows, accountRows, categoryRows] = await Promise.all([
        window.financeAPI.listRecurring(),
        window.financeAPI.listActiveAccounts(),
        window.financeAPI.listActiveCategories(),
      ])
      setRecurringRows(rows)
      setAccounts(accountRows)
      setCategories(categoryRows)
    } catch (err) {
      console.error(err)
      setError('Failed to load recurring transactions.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreate = () => {
    setSelectedRecurring(undefined)
    setDialogMode('create')
  }

  const handleEdit = (recurring: RecurringTransaction) => {
    setSelectedRecurring(recurring)
    setDialogMode('edit')
  }

  const handleDelete = async (recurring: RecurringTransaction) => {
    if (!window.confirm('Delete this recurring transaction? This cannot be undone.')) return

    try {
      await window.financeAPI.deleteRecurring(recurring.recurring_id!)
      await load()
    } catch (err) {
      console.error(err)
      setError('Failed to delete recurring transaction.')
    }
  }

  const closeDialog = () => {
    setDialogMode(null)
    setSelectedRecurring(undefined)
  }

  const handleSaved = async () => {
    closeDialog()
    await load()
  }

  return (
    <div className="recurring-page">
      <div className="recurring-page__header">
        <h1>Recurring Transactions</h1>
        <Button variant="pill" className="recurring-page__add-btn" onClick={handleCreate}>
          + Add Recurring
        </Button>
      </div>

      {error && <p className="recurring-page__error">{error}</p>}

      {isLoading ? (
        <div className="recurring-page__loading">Loading recurring transactions…</div>
      ) : recurringRows.length === 0 ? (
        <div className="recurring-page__empty">
          No recurring transactions found. Add one to get started.
        </div>
      ) : (
        <Card className="recurring-page__table-wrapper" padding="none">
          <table className="recurring-table">
            <thead>
              <tr>
                <th>Payee</th>
                <th>Type</th>
                <th>Account</th>
                <th className="recurring-table__amount-col">Amount</th>
                <th>Category</th>
                <th>Classification</th>
                <th>Frequency</th>
                <th>Start Date</th>
                <th>Next Due</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recurringRows.map((row) => {
                const nextDue = getNextDueDate(row)
                const amountClass =
                  row.transaction_type === TransactionType.Deposit
                    ? 'recurring-table__amount recurring-table__amount--deposit'
                    : 'recurring-table__amount recurring-table__amount--withdraw'
                const amountPrefix = row.transaction_type === TransactionType.Deposit ? '+' : '−'

                return (
                  <tr key={row.recurring_id} className="recurring-table__row">
                    <td>{row.payee || <span className="recurring-table__empty-cell">—</span>}</td>
                    <td>
                      <Tag>{row.transaction_type}</Tag>
                    </td>
                    <td>{row.account_id != null ? (accountMap.get(row.account_id) ?? row.account_id) : <span className="recurring-table__empty-cell">—</span>}</td>
                    <td className={amountClass}>
                      {amountPrefix}
                      {formatCurrency(row.amount)}
                    </td>
                    <td>
                      {row.category_id ? (
                        categoryPathMap.get(row.category_id) ?? row.category_id
                      ) : (
                        <span className="recurring-table__empty-cell">—</span>
                      )}
                    </td>
                    <td>{row.classification != null ? capitalize(row.classification) : <span className="recurring-table__empty-cell">—</span>}</td>
                    <td>{getFrequencyLabel(row)}</td>
                    <td>{formatDate(row.start_date)}</td>
                    <td>{nextDue ? formatDate(nextDue) : '—'}</td>
                    <td className="recurring-table__actions">
                      <Button variant="secondary" size="sm" onClick={() => handleEdit(row)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(row)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {dialogMode && (
        <RecurringDialog
          mode={dialogMode}
          recurring={selectedRecurring}
          accounts={accounts}
          categories={categories}
          onClose={closeDialog}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
