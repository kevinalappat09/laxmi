import { useEffect, useMemo, useState } from 'react'
import type { Account } from '../../../../src/types/account'
import type { Category } from '../../../../src/types/category'
import { buildCategoryPathMap } from '../../../../src/utils/categoryPaths'
import {
  BudgetStatus,
  BudgetType,
  type Budget,
  type BudgetWithSpending,
} from '../../../../src/types/budget'
import { AlertDialog, Button, Card, PageHeader, SegmentedControl } from '../../components/ui'
import { formatCurrency } from '../../utils/formatters'
import { BudgetDialog } from './BudgetDialog'
import './BudgetsPage.css'

type BudgetFilterType = 'all' | BudgetType

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function getScopeLabel(budget: BudgetWithSpending, categoryPaths: Map<number, string>): string {
  if (budget.budget_type === BudgetType.Overall) return 'All spending'
  if (budget.budget_type === BudgetType.Account) {
    return budget.account_name ? `Account: ${budget.account_name}` : `Account #${budget.account_id}`
  }
  if (budget.budget_type === BudgetType.Category) {
    const categoryPath = budget.category_id === undefined
      ? budget.category_name
      : categoryPaths.get(budget.category_id) ?? budget.category_name
    return categoryPath ? `Category: ${categoryPath}` : `Category #${budget.category_id}`
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
  const [budgetToDelete, setBudgetToDelete] = useState<BudgetWithSpending | null>(null)
  const categoryPathMap = useMemo(() => buildCategoryPathMap(categories), [categories])

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

  const handleDeleteConfirm = async () => {
    if (!budgetToDelete) return
    try {
      await window.financeAPI.deleteBudget(budgetToDelete.budget_id!)
      setBudgetToDelete(null)
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
      <PageHeader title="Budgets" actions={<Button variant="pill" className="budgets-page__add-btn" onClick={handleCreate}>
          + Add Budget
        </Button>} />

      <SegmentedControl className="budgets-page__filters" size="sm" ariaLabel="Budget type" value={activeFilter} onValueChange={(value) => setActiveFilter(value as BudgetType | 'all')} options={[
        { value: 'all', label: 'All' },
        { value: BudgetType.Overall, label: 'Overall' },
        { value: BudgetType.Account, label: 'Account' },
        { value: BudgetType.Category, label: 'Category' },
        { value: BudgetType.Classification, label: 'Classification' },
      ]} />

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

                <p className="budget-card__scope">{getScopeLabel(budget, categoryPathMap)}</p>
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
                    <Button variant="danger" size="sm" onClick={() => setBudgetToDelete(budget)}>
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
      <AlertDialog
        open={budgetToDelete !== null}
        onOpenChange={(open) => !open && setBudgetToDelete(null)}
        title="Delete budget?"
        description={`Delete “${budgetToDelete?.name ?? ''}” budget? This cannot be undone.`}
        confirmLabel="Delete budget"
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  )
}
