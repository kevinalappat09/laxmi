import { useEffect, useMemo, useState } from 'react'
import type { Account } from '../../../../src/types/account'
import { AccountSubType } from '../../../../src/types/account'
import type { Category } from '../../../../src/types/category'
import type { PortfolioAsset } from '../../../../src/types/portfolioAsset'
import {
  RecurringFrequency,
  type CreateRecurringTransactionRequest,
  type RecurringTransaction,
  type UpdateRecurringTransactionRequest,
} from '../../../../src/types/recurringTransaction'
import { Classification, TransactionType } from '../../../../src/types/transaction'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Input, Select } from '../../components/ui/Input'
import './RecurringDialog.css'

interface RecurringDialogProps {
  mode: 'create' | 'edit'
  recurring?: RecurringTransaction
  accounts: Account[]
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

const WEEKDAY_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
]

const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

function toDateInputValue(date: Date | string): string {
  const d = new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
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

export function RecurringDialog({
  mode,
  recurring,
  accounts,
  categories,
  onClose,
  onSaved,
}: RecurringDialogProps) {
  const isExistingSip = recurring?.portfolio_asset_id != null

  // ── SIP toggle ────────────────────────────────────────────────────────────
  const [isPortfolioSip, setIsPortfolioSip] = useState(isExistingSip)
  const [portfolioAssets, setPortfolioAssets] = useState<PortfolioAsset[]>([])
  const [portfolioAssetId, setPortfolioAssetId] = useState(
    recurring?.portfolio_asset_id ? String(recurring.portfolio_asset_id) : ''
  )
  const [assetAccountId, setAssetAccountId] = useState(
    recurring?.asset_account_id ? String(recurring.asset_account_id) : ''
  )
  // Source account for SIP (optional bank debit)
  const [sipSourceAccountId, setSipSourceAccountId] = useState(
    isExistingSip && recurring?.account_id ? String(recurring.account_id) : ''
  )

  // ── Regular fields ────────────────────────────────────────────────────────
  const defaultAccountId = (!isExistingSip && recurring?.account_id)
    ? recurring.account_id
    : (accounts[0]?.account_id ?? 0)
  const [accountId, setAccountId] = useState(String(defaultAccountId))
  const [transactionType, setTransactionType] = useState<TransactionType.Withdraw | TransactionType.Deposit>(
    recurring?.transaction_type ?? TransactionType.Withdraw
  )
  const [amount, setAmount] = useState(recurring?.amount ? String(recurring.amount) : '')
  const [categoryId, setCategoryId] = useState(
    recurring?.category_id ? String(recurring.category_id) : ''
  )
  const [classification, setClassification] = useState<Classification>(
    recurring?.classification ?? Classification.Needs
  )
  const [payee, setPayee] = useState(recurring?.payee ?? '')
  const [note, setNote] = useState(recurring?.note ?? '')
  const [frequency, setFrequency] = useState<RecurringFrequency>(
    recurring?.frequency ?? RecurringFrequency.Monthly
  )
  const [dayOfWeek, setDayOfWeek] = useState(
    recurring?.day_of_week !== undefined ? String(recurring.day_of_week) : '1'
  )
  const [dayOfMonth, setDayOfMonth] = useState(
    recurring?.day_of_month !== undefined ? String(recurring.day_of_month) : '1'
  )
  const [monthOfYear, setMonthOfYear] = useState(
    recurring?.month_of_year !== undefined ? String(recurring.month_of_year) : '1'
  )
  const [startDate, setStartDate] = useState(
    recurring?.start_date ? toDateInputValue(recurring.start_date) : toDateInputValue(new Date())
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const categoryPathMap = useMemo(() => createCategoryPathMap(categories), [categories])
  const investmentAccounts = useMemo(
    () => accounts.filter((a) => a.sub_type === AccountSubType.Investment),
    [accounts]
  )

  useEffect(() => {
    if (isPortfolioSip && portfolioAssets.length === 0) {
      window.financeAPI.portfolio.asset.list()
        .then(setPortfolioAssets)
        .catch(console.error)
    }
  }, [isPortfolioSip])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedAmount = Number(amount)
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be greater than 0.')
      return
    }
    if (!startDate) {
      setError('Start date is required.')
      return
    }

    if (isPortfolioSip) {
      if (!portfolioAssetId) {
        setError('Please select a fund.')
        return
      }
      if (!assetAccountId) {
        setError('Investment account is required for portfolio SIPs.')
        return
      }
    } else {
      if (!accountId) {
        setError('Account is required.')
        return
      }
    }

    const recurrencePayload: {
      day_of_week?: number
      day_of_month?: number
      month_of_year?: number
    } = {}

    if (frequency === RecurringFrequency.Weekly) {
      const parsedDay = Number(dayOfWeek)
      if (!Number.isInteger(parsedDay) || parsedDay < 0 || parsedDay > 6) {
        setError('Please select a valid day of week.')
        return
      }
      recurrencePayload.day_of_week = parsedDay
    }

    if (frequency === RecurringFrequency.Monthly || frequency === RecurringFrequency.Yearly) {
      const parsedDay = Number(dayOfMonth)
      if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31) {
        setError('Day of month must be between 1 and 31.')
        return
      }
      recurrencePayload.day_of_month = parsedDay
    }

    if (frequency === RecurringFrequency.Yearly) {
      const parsedMonth = Number(monthOfYear)
      if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
        setError('Please select a valid month.')
        return
      }
      recurrencePayload.month_of_year = parsedMonth
    }

    setSaving(true)
    try {
      if (mode === 'create') {
        const request: CreateRecurringTransactionRequest = isPortfolioSip
          ? {
              account_id: sipSourceAccountId ? Number(sipSourceAccountId) : null,
              transaction_type: TransactionType.Withdraw,
              amount: parsedAmount,
              classification: null,
              frequency,
              start_date: new Date(startDate),
              portfolio_asset_id: Number(portfolioAssetId),
              asset_account_id: Number(assetAccountId),
              ...recurrencePayload,
            }
          : {
              account_id: Number(accountId),
              transaction_type: transactionType,
              amount: parsedAmount,
              category_id: categoryId ? Number(categoryId) : undefined,
              classification,
              payee: payee.trim() || undefined,
              note: note.trim() || undefined,
              frequency,
              start_date: new Date(startDate),
              ...recurrencePayload,
            }
        await window.financeAPI.createRecurring(request)
      } else if (mode === 'edit' && recurring?.recurring_id) {
        const request: UpdateRecurringTransactionRequest = isPortfolioSip
          ? {
              account_id: sipSourceAccountId ? Number(sipSourceAccountId) : null,
              transaction_type: TransactionType.Withdraw,
              amount: parsedAmount,
              classification: null,
              frequency,
              start_date: new Date(startDate),
              portfolio_asset_id: Number(portfolioAssetId),
              asset_account_id: Number(assetAccountId),
              ...recurrencePayload,
            }
          : {
              account_id: Number(accountId),
              transaction_type: transactionType,
              amount: parsedAmount,
              category_id: categoryId ? Number(categoryId) : undefined,
              classification,
              payee: payee.trim() || undefined,
              note: note.trim() || undefined,
              frequency,
              start_date: new Date(startDate),
              ...recurrencePayload,
            }
        await window.financeAPI.updateRecurring(recurring.recurring_id, request)
      }

      onSaved()
    } catch (err) {
      console.error(err)
      setError('Failed to save recurring transaction. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      isOpen
      className="recurring-dialog"
      panelClassName="recurring-dialog__panel"
      bodyClassName="recurring-dialog__body"
      title={mode === 'create' ? 'Add Recurring Transaction' : 'Edit Recurring Transaction'}
      onClose={onClose}
    >
      <form className="recurring-dialog__form" onSubmit={handleSubmit}>
        {/* ── Portfolio SIP toggle ─────────────────────────────────────── */}
        <div className="recurring-dialog__sip-toggle">
          <label className="recurring-dialog__sip-label">
            <input
              type="checkbox"
              checked={isPortfolioSip}
              onChange={(e) => setIsPortfolioSip(e.target.checked)}
              className="recurring-dialog__sip-checkbox"
            />
            This is a mutual fund SIP
          </label>
        </div>

        <div className="recurring-dialog__grid">
          {isPortfolioSip ? (
            <>
              {/* ── SIP fields ──────────────────────────────────────────── */}
              <Select
                id="recurring-fund"
                label="Fund"
                className="recurring-dialog__field"
                value={portfolioAssetId}
                onChange={(e) => setPortfolioAssetId(e.target.value)}
                required
              >
                <option value="" disabled>Select fund…</option>
                {portfolioAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </Select>

              <Select
                id="recurring-asset-account"
                label="Investment Account"
                className="recurring-dialog__field"
                value={assetAccountId}
                onChange={(e) => setAssetAccountId(e.target.value)}
                required
              >
                <option value="" disabled>Select investment account…</option>
                {investmentAccounts.map((account) => (
                  <option key={account.account_id} value={account.account_id}>
                    {account.account_name}
                  </option>
                ))}
              </Select>

              <Select
                id="recurring-sip-source"
                label="Source Account (optional)"
                className="recurring-dialog__field"
                value={sipSourceAccountId}
                onChange={(e) => setSipSourceAccountId(e.target.value)}
              >
                <option value="">None — no bank debit</option>
                {accounts.map((account) => (
                  <option key={account.account_id} value={account.account_id}>
                    {account.account_name}
                  </option>
                ))}
              </Select>

              <Input
                id="recurring-amount"
                label="SIP Amount (₹)"
                className="recurring-dialog__field"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </>
          ) : (
            <>
              {/* ── Regular recurring fields ─────────────────────────────── */}
              <Select
                id="recurring-account"
                label="Account"
                className="recurring-dialog__field"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
              >
                <option value="" disabled>Select account…</option>
                {accounts.map((account) => (
                  <option key={account.account_id} value={account.account_id}>
                    {account.account_name}
                  </option>
                ))}
              </Select>

              <Input
                id="recurring-payee"
                label="Payee"
                className="recurring-dialog__field"
                type="text"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                placeholder="e.g. Rent, Salary"
              />

              <Select
                id="recurring-type"
                label="Type"
                className="recurring-dialog__field"
                value={transactionType}
                onChange={(e) =>
                  setTransactionType(e.target.value as TransactionType.Withdraw | TransactionType.Deposit)
                }
              >
                <option value={TransactionType.Withdraw}>Withdraw</option>
                <option value={TransactionType.Deposit}>Deposit</option>
              </Select>

              <Input
                id="recurring-amount"
                label="Amount"
                className="recurring-dialog__field"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />

              <Select
                id="recurring-category"
                label="Category"
                className="recurring-dialog__field"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.category_id} value={category.category_id}>
                    {category.category_id
                      ? categoryPathMap.get(category.category_id)
                      : category.category_name}
                  </option>
                ))}
              </Select>

              <Select
                id="recurring-classification"
                label="Classification"
                className="recurring-dialog__field"
                value={classification}
                onChange={(e) => setClassification(e.target.value as Classification)}
              >
                <option value={Classification.Needs}>Needs</option>
                <option value={Classification.Wants}>Wants</option>
                <option value={Classification.Unnecessary}>Unnecessary</option>
                <option value={Classification.Wasteful}>Wasteful</option>
              </Select>
            </>
          )}

          {/* ── Shared: frequency + recurrence + start date ─────────────── */}
          <Select
            id="recurring-frequency"
            label="Frequency"
            className="recurring-dialog__field"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
          >
            <option value={RecurringFrequency.Weekly}>Weekly</option>
            <option value={RecurringFrequency.Monthly}>Monthly</option>
            <option value={RecurringFrequency.Yearly}>Yearly</option>
          </Select>

          {frequency === RecurringFrequency.Weekly && (
            <Select
              id="recurring-day-week"
              label="Day of Week"
              className="recurring-dialog__field"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value)}
            >
              {WEEKDAY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}

          {frequency === RecurringFrequency.Monthly && (
            <Input
              id="recurring-day-month"
              label="Day of Month"
              className="recurring-dialog__field"
              type="number"
              min="1"
              max="31"
              step="1"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
            />
          )}

          {frequency === RecurringFrequency.Yearly && (
            <>
              <Select
                id="recurring-month-year"
                label="Month"
                className="recurring-dialog__field"
                value={monthOfYear}
                onChange={(e) => setMonthOfYear(e.target.value)}
              >
                {MONTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Input
                id="recurring-day-year"
                label="Day of Month"
                className="recurring-dialog__field"
                type="number"
                min="1"
                max="31"
                step="1"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
              />
            </>
          )}

          <Input
            id="recurring-start-date"
            label="Start Date"
            className="recurring-dialog__field"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />

          {!isPortfolioSip && (
            <div className="recurring-dialog__field recurring-dialog__field--full">
              <label htmlFor="recurring-note">
                Note <span className="recurring-dialog__optional">(optional)</span>
              </label>
              <textarea
                id="recurring-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Add a note…"
              />
            </div>
          )}
        </div>

        {isPortfolioSip && (
          <p className="recurring-dialog__sip-hint">
            On each due date, ₹{amount || '—'} will be invested at the NAV of that date.
            {sipSourceAccountId
              ? ` The selected account will be debited.`
              : ' No bank account will be debited.'}
          </p>
        )}

        {error && <p className="recurring-dialog__error">{error}</p>}

        <div className="recurring-dialog__actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="pill" disabled={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Add Recurring' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
