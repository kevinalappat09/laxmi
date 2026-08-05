import { useEffect, useMemo, useState } from 'react'
import type { Account } from '../../../../src/types/account'
import type { Category } from '../../../../src/types/category'
import { Classification, type Transaction } from '../../../../src/types/transaction'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Select } from '../../components/ui/Input'
import { MultiSelectDropdown } from '../../components/ui/MultiSelectDropdown'
import { CLASSIFICATION_OPTIONS, getDateRangeForPreset, type DateRangePreset } from '../../utils/chartUtils'
import { AccountsReports } from './tabs/AccountsReports'
import { CategoryReports } from './tabs/CategoryReports'
import { ClassificationReports } from './tabs/ClassificationReports'
import { TemporalReports } from './tabs/TemporalReports'
import './ReportsPage.css'

type ReportTab = 'temporal' | 'category' | 'classification' | 'accounts'

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function toDateInputValue(date: Date): string {
  return date.toISOString().split('T')[0]
}

function parseDateInput(value: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function resolveDateRange(preset: DateRangePreset, customFrom: string, customTo: string): { from: Date; to: Date } {
  if (preset !== 'custom') {
    return getDateRangeForPreset(preset)
  }

  const parsedFrom = parseDateInput(customFrom)
  const parsedTo = parseDateInput(customTo)
  if (!parsedFrom || !parsedTo) {
    return getDateRangeForPreset('current-month')
  }

  if (parsedFrom.getTime() <= parsedTo.getTime()) {
    return { from: parsedFrom, to: parsedTo }
  }

  return { from: parsedTo, to: parsedFrom }
}
export function ReportsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ReportTab>('temporal')

  const [datePreset, setDatePreset] = useState<DateRangePreset>('current-month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number> | null>(null)
  const [selectedClassifications, setSelectedClassifications] = useState<Set<Classification> | null>(null)

  useEffect(() => {
    const defaultRange = getDateRangeForPreset('current-month')
    setCustomFrom(toDateInputValue(defaultRange.from))
    setCustomTo(toDateInputValue(defaultRange.to))
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadReferenceData() {
      setIsLoading(true)
      setError(null)
      try {
        const [loadedAccounts, loadedCategories] = await Promise.all([
          window.financeAPI.listActiveAccounts(),
          window.financeAPI.listActiveCategories(),
        ])
        if (!isMounted) return

        setAccounts(loadedAccounts)
        setCategories(loadedCategories)
      } catch (err) {
        console.error(err)
        if (!isMounted) return
        setError('Failed to load report filters.')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadReferenceData()

    return () => {
      isMounted = false
    }
  }, [])

  const activeRange = useMemo(
    () => resolveDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo]
  )

  useEffect(() => {
    let isMounted = true

    async function loadTransactions() {
      setIsLoading(true)
      setError(null)
      try {
        if (accounts.length === 0) {
          setTransactions([])
          return
        }

        const results = await Promise.all(
          accounts.map((account) =>
            window.financeAPI.findTransactionsWithFilter({
              accountId: account.account_id,
              fromDate: activeRange.from,
              toDate: activeRange.to,
            })
          )
        )
        if (!isMounted) return

        const merged = results.flat()
        merged.sort(
          (a, b) =>
            new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
        )
        setTransactions(merged)
      } catch (err) {
        console.error(err)
        if (!isMounted) return
        setError('Failed to load report data.')
        setTransactions([])
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadTransactions()

    return () => {
      isMounted = false
    }
  }, [accounts, activeRange.from, activeRange.to])

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: String(account.account_id),
        label: account.account_name,
      })),
    [accounts]
  )

  const classificationOptions = useMemo(
    () =>
      CLASSIFICATION_OPTIONS.map((classification) => ({
        value: classification,
        label: capitalize(classification),
      })),
    []
  )

  const filteredTransactions = useMemo(() => {
    const activeAccountIds = selectedAccountIds ?? new Set(accounts.map((account) => account.account_id))
    const activeClassifications = selectedClassifications ?? new Set(CLASSIFICATION_OPTIONS)

    if (activeAccountIds.size === 0 || activeClassifications.size === 0) {
      return []
    }

    return transactions.filter(
      (tx) => activeAccountIds.has(tx.account_id) && activeClassifications.has(tx.classification)
    )
  }, [transactions, accounts, selectedAccountIds, selectedClassifications])

  function renderActiveTab() {
    switch (activeTab) {
      case 'temporal':
        return (
          <TemporalReports
            transactions={filteredTransactions}
            fromDate={activeRange.from}
            toDate={activeRange.to}
          />
        )
      case 'category':
        return (
          <CategoryReports
            transactions={filteredTransactions}
            categories={categories}
            fromDate={activeRange.from}
            toDate={activeRange.to}
          />
        )
      case 'classification':
        return (
          <ClassificationReports
            transactions={filteredTransactions}
            fromDate={activeRange.from}
            toDate={activeRange.to}
          />
        )
      case 'accounts':
        return <AccountsReports transactions={filteredTransactions} accounts={accounts} />
      default:
        return null
    }
  }

  return (
    <div className="reports-page">
      <div className="reports-page__header">
        <h1>Reports</h1>
      </div>

      <Card className="reports-page__filters">
        <div className="reports-page__filter-grid">
          <Select
            id="reports-date-range"
            label="Date range"
            className="reports-page__field"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DateRangePreset)}
          >
            <option value="last-7-days">Last 7 days</option>
            <option value="last-14-days">Last 14 days</option>
            <option value="current-month">Current month</option>
            <option value="last-month">Last month</option>
            <option value="last-30-days">Last 30 days</option>
            <option value="current-year">Current year</option>
            <option value="last-year">Last year</option>
            <option value="custom">Custom</option>
          </Select>

          {datePreset === 'custom' && (
            <>
              <div className="ui-field reports-page__field">
                <label className="ui-field__label" htmlFor="reports-custom-from">
                  Date from
                </label>
                <input
                  id="reports-custom-from"
                  className="ui-field__control"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="ui-field reports-page__field">
                <label className="ui-field__label" htmlFor="reports-custom-to">
                  Date to
                </label>
                <input
                  id="reports-custom-to"
                  className="ui-field__control"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="reports-page__field-actions">
            <MultiSelectDropdown
              id="reports-account-filter"
              label="Account"
              className="reports-page__field reports-page__field-actions-control"
              options={accountOptions}
              selectedValues={
                selectedAccountIds
                  ? Array.from(selectedAccountIds, String)
                  : accountOptions.map((option) => option.value)
              }
              onChange={(values) => {
                const next = new Set(values.map(Number))
                setSelectedAccountIds(next.size === accountOptions.length ? null : next)
              }}
              placeholder="No accounts"
              allSelectedLabel="All accounts"
              disabled={accountOptions.length === 0}
            />
            <div className="reports-page__field-actions-buttons">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setSelectedAccountIds(null)}
                disabled={accountOptions.length === 0}
              >
                All
              </Button>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setSelectedAccountIds(new Set())}
                disabled={accountOptions.length === 0}
              >
                None
              </Button>
            </div>
          </div>

          <div className="reports-page__field-actions">
            <MultiSelectDropdown
              id="reports-classification-filter"
              label="Classification"
              className="reports-page__field reports-page__field-actions-control"
              options={classificationOptions}
              selectedValues={
                selectedClassifications
                  ? Array.from(selectedClassifications)
                  : classificationOptions.map((option) => option.value)
              }
              onChange={(values) => {
                const next = new Set(values as Classification[])
                setSelectedClassifications(next.size === classificationOptions.length ? null : next)
              }}
              placeholder="No classifications"
              allSelectedLabel="All classifications"
            />
            <div className="reports-page__field-actions-buttons">
              <Button variant="subtle" size="sm" onClick={() => setSelectedClassifications(null)}>
                All
              </Button>
              <Button variant="subtle" size="sm" onClick={() => setSelectedClassifications(new Set())}>
                None
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="reports-page__tabs" role="tablist" aria-label="Report types">
        <Button
          role="tab"
          aria-selected={activeTab === 'temporal'}
          variant="subtle"
          size="sm"
          className={`reports-page__tab-button ${
            activeTab === 'temporal' ? 'reports-page__tab-button--active' : ''
          }`}
          onClick={() => setActiveTab('temporal')}
        >
          Temporal
        </Button>
        <Button
          role="tab"
          aria-selected={activeTab === 'category'}
          variant="subtle"
          size="sm"
          className={`reports-page__tab-button ${
            activeTab === 'category' ? 'reports-page__tab-button--active' : ''
          }`}
          onClick={() => setActiveTab('category')}
        >
          Category
        </Button>
        <Button
          role="tab"
          aria-selected={activeTab === 'classification'}
          variant="subtle"
          size="sm"
          className={`reports-page__tab-button ${
            activeTab === 'classification' ? 'reports-page__tab-button--active' : ''
          }`}
          onClick={() => setActiveTab('classification')}
        >
          Classification
        </Button>
        <Button
          role="tab"
          aria-selected={activeTab === 'accounts'}
          variant="subtle"
          size="sm"
          className={`reports-page__tab-button ${
            activeTab === 'accounts' ? 'reports-page__tab-button--active' : ''
          }`}
          onClick={() => setActiveTab('accounts')}
        >
          Accounts
        </Button>
      </div>

      {error && <p className="reports-page__error">{error}</p>}
      {isLoading && <p className="reports-page__loading">Loading report data…</p>}

      {renderActiveTab()}
    </div>
  )
}
