import { useEffect, useMemo, useState } from 'react'
import type { Account } from '../../../../src/types/account'
import type { Category } from '../../../../src/types/category'
import {
  BudgetStatus,
  BudgetType,
  type Budget,
  type BudgetWithSpending,
} from '../../../../src/types/budget'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { formatCurrency } from '../../utils/formatters'
import { BudgetDialog } from './BudgetDialog'
import './BudgetsPage.css'

type BudgetFilterType = 'all' | BudgetType

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function getScopeLabel(budget: BudgetWithSpending): string {
  if (budget.budget_type === BudgetType.Overall) return 'All spending'
  if (budget.budget_type === BudgetType.Account) {
    return budget.account_name ? `Account: ${budget.account_name}` : `Account #${budget.account_id}`
  }
  if (budget.budget_type === BudgetType.Category) {
    return budget.category_name ? `Category: ${budget.category_name}` : `Category #${budget.category_id}`
  }
  return `Classification: ${capitalize(budget.classification ?? '')}`
}

function getStatusLabel(status: BudgetStatus): string {
  if (status === BudgetStatus.OverBudget) return 'Over Budget'
  if (status === BudgetStatus.Warning) return 'Warning'
  return 'On Track'
}

export function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetWithSpending[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<BudgetFilterType>('all')
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null)
  const [selectedBudget, setSelectedBudget] = useState<Budget | undefined>(undefined)

  const load = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [budgetRows, accountRows, categoryRows] = await Promise.all([
        window.financeAPI.listBudgetsWithSpending(),
        window.financeAPI.listActiveAccounts(),
        window.financeAPI.listActiveCategories(),
      ])
      setBudgets(budgetRows)
      setAccounts(accountRows)
      setCategories(categoryRows)
    } catch (err) {
      console.error(err)
      setError('Failed to load budgets.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredBudgets = useMemo(() => {
    if (activeFilter === 'all') return budgets
    return budgets.filter((budget) => budget.budget_type === activeFilter)
  }, [activeFilter, budgets])

  const handleCreate = () => {
    setSelectedBudget(undefined)
    setDialogMode('create')
  }

  const handleEdit = (budget: BudgetWithSpending) => {
    setSelectedBudget(budget)
    setDialogMode('edit')
  }

  const handleDelete = async (budget: BudgetWithSpending) => {
    if (!window.confirm(`Delete "${budget.name}" budget? This cannot be undone.`)) return

    try {
      await window.financeAPI.deleteBudget(budget.budget_id!)
      await load()
    } catch (err) {
      console.error(err)
      setError('Failed to delete budget.')
    }
  }

  const closeDialog = () => {
    setDialogMode(null)
    setSelectedBudget(undefined)
  }

  const handleSaved = async () => {
    closeDialog()
    await load()
  }

  return (
    <div className="budgets-page">
      <div className="budgets-page__header">
        <h1>Budgets</h1>
        <Button variant="pill" className="budgets-page__add-btn" onClick={handleCreate}>
          + Add Budget
        </Button>
      </div>

      <div className="budgets-page__filters">
        <Button
          variant={activeFilter === 'all' ? 'pill' : 'secondary'}
          size="sm"
          onClick={() => setActiveFilter('all')}
        >
          All
        </Button>
        <Button
          variant={activeFilter === BudgetType.Overall ? 'pill' : 'secondary'}
          size="sm"
          onClick={() => setActiveFilter(BudgetType.Overall)}
        >
          Overall
        </Button>
        <Button
          variant={activeFilter === BudgetType.Account ? 'pill' : 'secondary'}
          size="sm"
          onClick={() => setActiveFilter(BudgetType.Account)}
        >
          Account
        </Button>
        <Button
          variant={activeFilter === BudgetType.Category ? 'pill' : 'secondary'}
          size="sm"
          onClick={() => setActiveFilter(BudgetType.Category)}
        >
          Category
        </Button>
        <Button
          variant={activeFilter === BudgetType.Classification ? 'pill' : 'secondary'}
          size="sm"
          onClick={() => setActiveFilter(BudgetType.Classification)}
        >
          Classification
        </Button>
      </div>

      {error && <p className="budgets-page__error">{error}</p>}

      {isLoading ? (
        <div className="budgets-page__loading">Loading budgets…</div>
      ) : filteredBudgets.length === 0 ? (
        <div className="budgets-page__empty">No budgets found. Add one to get started.</div>
      ) : (
        <div className="budgets-page__list">
          {filteredBudgets.map((budget) => {
            const progress = Math.min(budget.percentage, 100)
            return (
              <Card key={budget.budget_id} className="budget-card">
                <div className="budget-card__header">
                  <div>
                    <h2 className="budget-card__title">{budget.name}</h2>
                    <p className="budget-card__meta">
                      {capitalize(budget.period)} · {capitalize(budget.budget_type)}
                    </p>
                  </div>
                  <span
                    className={`budget-card__status budget-card__status--${budget.status}`}
                  >
                    {getStatusLabel(budget.status)}
                  </span>
                </div>

                <p className="budget-card__scope">{getScopeLabel(budget)}</p>
                <p className="budget-card__period">For {budget.period_label}</p>

                <div className="budget-card__numbers">
                  <span>{formatCurrency(budget.spent)} spent</span>
                  <span>{formatCurrency(budget.amount)} limit</span>
                </div>

                <div className="budget-card__progress-track" aria-hidden>
                  <div
                    className={`budget-card__progress-fill budget-card__progress-fill--${budget.status}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="budget-card__footer">
                  <span className="budget-card__percent">{budget.percentage.toFixed(1)}% used</span>
                  <div className="budget-card__actions">
                    <Button variant="secondary" size="sm" onClick={() => handleEdit(budget)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(budget)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {dialogMode && (
        <BudgetDialog
          mode={dialogMode}
          budget={selectedBudget}
          accounts={accounts}
          categories={categories}
          onClose={closeDialog}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
