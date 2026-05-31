import { useMemo, useState } from 'react'
import type { Account } from '../../../../src/types/account'
import type { Category } from '../../../../src/types/category'
import {
  BudgetPeriod,
  BudgetType,
  type Budget,
  type CreateBudgetRequest,
  type UpdateBudgetRequest,
} from '../../../../src/types/budget'
import { Classification } from '../../../../src/types/transaction'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Input, Select } from '../../components/ui/Input'
import './BudgetDialog.css'

interface BudgetDialogProps {
  mode: 'create' | 'edit'
  budget?: Budget
  accounts: Account[]
  categories: Category[]
  onClose: () => void
  onSaved: () => void
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

export function BudgetDialog({
  mode,
  budget,
  accounts,
  categories,
  onClose,
  onSaved,
}: BudgetDialogProps) {
  const [name, setName] = useState(budget?.name ?? '')
  const [budgetType, setBudgetType] = useState<BudgetType>(budget?.budget_type ?? BudgetType.Overall)
  const [period, setPeriod] = useState<BudgetPeriod>(budget?.period ?? BudgetPeriod.Monthly)
  const [amount, setAmount] = useState(budget?.amount ? String(budget.amount) : '')
  const [accountId, setAccountId] = useState(budget?.account_id ? String(budget.account_id) : '')
  const [categoryId, setCategoryId] = useState(budget?.category_id ? String(budget.category_id) : '')
  const [classification, setClassification] = useState<Classification>(
    budget?.classification ?? Classification.Needs
  )
  const [warningPercent, setWarningPercent] = useState(
    String(Math.round((budget?.warning_threshold ?? 0.8) * 100))
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const categoryPathMap = useMemo(() => createCategoryPathMap(categories), [categories])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedAmount = Number(amount)
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be greater than 0.')
      return
    }

    const warningThreshold = Number(warningPercent) / 100
    if (Number.isNaN(warningThreshold) || warningThreshold <= 0 || warningThreshold > 1) {
      setError('Warning threshold must be between 1 and 100.')
      return
    }

    if (budgetType === BudgetType.Account && !accountId) {
      setError('Please select an account.')
      return
    }
    if (budgetType === BudgetType.Category && !categoryId) {
      setError('Please select a category.')
      return
    }

    const basePayload = {
      name: name.trim(),
      budget_type: budgetType,
      period,
      amount: parsedAmount,
      warning_threshold: warningThreshold,
    }

    setSaving(true)
    try {
      if (mode === 'create') {
        const request: CreateBudgetRequest = {
          ...basePayload,
          account_id: budgetType === BudgetType.Account ? Number(accountId) : undefined,
          category_id: budgetType === BudgetType.Category ? Number(categoryId) : undefined,
          classification:
            budgetType === BudgetType.Classification ? classification : undefined,
        }
        await window.financeAPI.createBudget(request)
      } else if (mode === 'edit' && budget?.budget_id) {
        const request: UpdateBudgetRequest = {
          ...basePayload,
          account_id: budgetType === BudgetType.Account ? Number(accountId) : undefined,
          category_id: budgetType === BudgetType.Category ? Number(categoryId) : undefined,
          classification:
            budgetType === BudgetType.Classification ? classification : undefined,
        }
        await window.financeAPI.updateBudget(budget.budget_id, request)
      }

      onSaved()
    } catch (err) {
      console.error(err)
      setError('Failed to save budget. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      isOpen
      className="budget-dialog"
      panelClassName="budget-dialog__panel"
      bodyClassName="budget-dialog__body"
      title={mode === 'create' ? 'Add Budget' : 'Edit Budget'}
      onClose={onClose}
    >
      <form className="budget-dialog__form" onSubmit={handleSubmit}>
        <Input
          id="budget-name"
          label="Budget Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Monthly Essentials"
          required
        />

        <div className="budget-dialog__grid">
          <Select
            id="budget-type"
            label="Budget Type"
            value={budgetType}
            onChange={(e) => setBudgetType(e.target.value as BudgetType)}
          >
            <option value={BudgetType.Overall}>Overall</option>
            <option value={BudgetType.Account}>Account</option>
            <option value={BudgetType.Category}>Category</option>
            <option value={BudgetType.Classification}>Classification</option>
          </Select>

          <Select
            id="budget-period"
            label="Period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}
          >
            <option value={BudgetPeriod.Monthly}>Monthly</option>
            <option value={BudgetPeriod.Yearly}>Yearly</option>
          </Select>
        </div>

        <Input
          id="budget-amount"
          label="Limit Amount"
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
        />

        {budgetType === BudgetType.Account && (
          <Select
            id="budget-account"
            label="Account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
          >
            <option value="">Select account…</option>
            {accounts.map((account) => (
              <option key={account.account_id} value={account.account_id}>
                {account.account_name}
              </option>
            ))}
          </Select>
        )}

        {budgetType === BudgetType.Category && (
          <Select
            id="budget-category"
            label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="">Select category…</option>
            {categories.map((category) => (
              <option key={category.category_id} value={category.category_id}>
                {category.category_id ? categoryPathMap.get(category.category_id) : category.category_name}
              </option>
            ))}
          </Select>
        )}

        {budgetType === BudgetType.Classification && (
          <Select
            id="budget-classification"
            label="Classification"
            value={classification}
            onChange={(e) => setClassification(e.target.value as Classification)}
          >
            <option value={Classification.Needs}>Needs</option>
            <option value={Classification.Wants}>Wants</option>
            <option value={Classification.Unnecessary}>Unnecessary</option>
            <option value={Classification.Wasteful}>Wasteful</option>
          </Select>
        )}

        <details className="budget-dialog__advanced">
          <summary>Advanced</summary>
          <div className="budget-dialog__advanced-content">
            <label htmlFor="budget-warning-threshold">
              Warning threshold ({warningPercent}%)
            </label>
            <input
              id="budget-warning-threshold"
              type="range"
              min="50"
              max="100"
              step="1"
              value={warningPercent}
              onChange={(e) => setWarningPercent(e.target.value)}
            />
          </div>
        </details>

        {error && <p className="budget-dialog__error">{error}</p>}

        <div className="budget-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="pill" disabled={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Add Budget' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
