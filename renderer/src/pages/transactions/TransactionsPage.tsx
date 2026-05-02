import { useEffect, useState } from 'react'
import type { Account } from '../../../../src/types/account'
import type { Category } from '../../../../src/types/category'
import type { Transaction } from '../../../../src/types/transaction'
import { TransactionType, Classification } from '../../../../src/types/transaction'
import { TransactionDialog } from './TransactionDialog'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input, Select } from '../../components/ui/Input'
import { MultiSelectDropdown } from '../../components/ui/MultiSelectDropdown'
import { Tag } from '../../components/ui/Tag'
import { formatCurrency, formatDate } from '../../utils/formatters'
import './TransactionsPage.css'

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

interface Filters {
  accountIds: string[]
  dateFrom: string
  dateTo: string
  minAmount: string
  maxAmount: string
  transactionType: string
  classification: string
  categoryIds: string[]
}

const EMPTY_FILTERS: Filters = {
  accountIds: [],
  dateFrom: '',
  dateTo: '',
  minAmount: '',
  maxAmount: '',
  transactionType: '',
  classification: '',
  categoryIds: [],
}

interface TransactionsPageProps {
  autoOpenDialog?: boolean
  onAutoOpenHandled?: () => void
}

export function TransactionsPage({ autoOpenDialog, onAutoOpenHandled }: TransactionsPageProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | undefined>(undefined)

  const accountMap = new Map(accounts.map((a) => [a.account_id, a.account_name]))
  const categoryMap = new Map(categories.map((c) => [c.category_id, c.category_name]))

  const loadReferenceData = async () => {
    const [accts, cats] = await Promise.all([
      window.financeAPI.listActiveAccounts(),
      window.financeAPI.listActiveCategories(),
    ])
    return { accts, cats }
  }

  const loadTransactions = async (accts: Account[], activeFilters: Filters) => {
    const accountsToQuery = activeFilters.accountIds.length > 0
      ? accts.filter((a) => activeFilters.accountIds.includes(String(a.account_id)))
      : accts

    if (accountsToQuery.length === 0) {
      return []
    }

    const results = await Promise.all(
      accountsToQuery.map((account) => {
        const query: any = { accountId: account.account_id }
        if (activeFilters.dateFrom) query.fromDate = new Date(activeFilters.dateFrom)
        if (activeFilters.dateTo) query.toDate = new Date(activeFilters.dateTo)
        if (activeFilters.minAmount) query.minAmount = Number(activeFilters.minAmount)
        if (activeFilters.maxAmount) query.maxAmount = Number(activeFilters.maxAmount)
        if (activeFilters.transactionType) query.types = new Set([activeFilters.transactionType])
        if (activeFilters.classification) query.classifications = new Set([activeFilters.classification])
        if (activeFilters.categoryIds.length > 0) {
          query.categoryIds = new Set(activeFilters.categoryIds.map(Number))
        }
        return window.financeAPI.findTransactionsWithFilter(query)
      })
    )

    const merged = results.flat()
    merged.sort(
      (a, b) =>
        new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
    )
    return merged
  }

  const load = async (activeFilters: Filters = filters) => {
    setIsLoading(true)
    setError(null)
    try {
      const { accts, cats } = await loadReferenceData()
      setAccounts(accts)
      setCategories(cats)
      const txns = await loadTransactions(accts, activeFilters)
      setTransactions(txns)
    } catch (err) {
      console.error(err)
      setError('Failed to load transactions.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (autoOpenDialog) {
      setSelectedTransaction(undefined)
      setDialogMode('create')
      onAutoOpenHandled?.()
    }
  }, [autoOpenDialog])

  const handleFilterChange = (
    field: 'dateFrom' | 'dateTo' | 'minAmount' | 'maxAmount' | 'transactionType' | 'classification',
    value: string
  ) => {
    const updated = { ...filters, [field]: value }
    setFilters(updated)
    load(updated)
  }

  const handleMultiSelectFilterChange = (field: 'accountIds' | 'categoryIds', values: string[]) => {
    const updated = { ...filters, [field]: values }
    setFilters(updated)
    load(updated)
  }

  const handleClearFilters = () => {
    setFilters(EMPTY_FILTERS)
    load(EMPTY_FILTERS)
  }

  const handleAddClick = () => {
    setSelectedTransaction(undefined)
    setDialogMode('create')
  }

  const handleEditClick = (tx: Transaction) => {
    setSelectedTransaction(tx)
    setDialogMode('edit')
  }

  const handleDeleteClick = async (tx: Transaction) => {
    if (!window.confirm('Delete this transaction? This cannot be undone.')) return
    try {
      await window.financeAPI.deleteTransaction(tx.transaction_id!)
      await load()
    } catch (err) {
      console.error(err)
      setError('Failed to delete transaction.')
    }
  }

  const handleDialogClose = () => {
    setDialogMode(null)
    setSelectedTransaction(undefined)
  }

  const handleDialogSaved = () => {
    handleDialogClose()
    load()
  }

  const hasActiveFilters =
    filters.accountIds.length > 0 ||
    filters.categoryIds.length > 0 ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '' ||
    filters.minAmount !== '' ||
    filters.maxAmount !== '' ||
    filters.transactionType !== '' ||
    filters.classification !== ''

  return (
    <div className="transactions-page">
      <div className="transactions-page__header">
        <h1>Transactions</h1>
        <Button variant="pill" className="transactions-page__add-btn" onClick={handleAddClick}>
          + Add Transaction
        </Button>
      </div>

      <Card className="transactions-page__filters">
        <div className="transactions-page__filter-row">
          <div className="transactions-page__filter-with-actions">
            <MultiSelectDropdown
              id="filter-account"
              label="Account"
              className="transactions-page__filter-group transactions-page__filter-with-actions-control"
              options={accounts.map((account) => ({
                value: String(account.account_id),
                label: account.account_name,
              }))}
              selectedValues={filters.accountIds}
              onChange={(values) => handleMultiSelectFilterChange('accountIds', values)}
              placeholder="All accounts"
              allSelectedLabel="All accounts"
            />
            <div className="transactions-page__filter-actions-buttons">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => handleMultiSelectFilterChange('accountIds', accounts.map((a) => String(a.account_id)))}
                disabled={accounts.length === 0}
              >
                All
              </Button>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => handleMultiSelectFilterChange('accountIds', [])}
                disabled={accounts.length === 0}
              >
                None
              </Button>
            </div>
          </div>

          <Input
            id="filter-date-from"
            label="Date From"
            className="transactions-page__filter-group"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
          />

          <Input
            id="filter-date-to"
            label="Date To"
            className="transactions-page__filter-group"
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
          />

          <Input
            id="filter-min-amount"
            label="Min Amount"
            className="transactions-page__filter-group"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={filters.minAmount}
            onChange={(e) => handleFilterChange('minAmount', e.target.value)}
          />

          <Input
            id="filter-max-amount"
            label="Max Amount"
            className="transactions-page__filter-group"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={filters.maxAmount}
            onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
          />

          <Select
            id="filter-type"
            label="Type"
            className="transactions-page__filter-group"
            value={filters.transactionType}
            onChange={(e) => handleFilterChange('transactionType', e.target.value)}
          >
              <option value="">All Types</option>
              <option value={TransactionType.Withdraw}>Withdraw</option>
              <option value={TransactionType.Deposit}>Deposit</option>
              <option value={TransactionType.Transfer}>Transfer</option>
          </Select>

          <Select
            id="filter-classification"
            label="Classification"
            className="transactions-page__filter-group"
            value={filters.classification}
            onChange={(e) => handleFilterChange('classification', e.target.value)}
          >
              <option value="">All</option>
              <option value={Classification.Needs}>Needs</option>
              <option value={Classification.Wants}>Wants</option>
              <option value={Classification.Unnecessary}>Unnecessary</option>
              <option value={Classification.Wasteful}>Wasteful</option>
          </Select>

          <div className="transactions-page__filter-with-actions">
            <MultiSelectDropdown
              id="filter-category"
              label="Category"
              className="transactions-page__filter-group transactions-page__filter-with-actions-control"
              options={categories
                .filter((category): category is Category & { category_id: number } => category.category_id !== undefined)
                .map((category) => ({
                  value: String(category.category_id),
                  label: category.category_name,
                }))}
              selectedValues={filters.categoryIds}
              onChange={(values) => handleMultiSelectFilterChange('categoryIds', values)}
              placeholder="All categories"
              allSelectedLabel="All categories"
            />
            <div className="transactions-page__filter-actions-buttons">
              <Button
                variant="subtle"
                size="sm"
                onClick={() =>
                  handleMultiSelectFilterChange(
                    'categoryIds',
                    categories
                      .filter((category): category is Category & { category_id: number } => category.category_id !== undefined)
                      .map((category) => String(category.category_id))
                  )
                }
                disabled={categories.length === 0}
              >
                All
              </Button>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => handleMultiSelectFilterChange('categoryIds', [])}
                disabled={categories.length === 0}
              >
                None
              </Button>
            </div>
          </div>

          {hasActiveFilters && (
            <Button
              variant="subtle"
              size="sm"
              className="transactions-page__clear-btn"
              onClick={handleClearFilters}
            >
              Clear Filters
            </Button>
          )}
        </div>
      </Card>

      {error && <p className="transactions-page__error">{error}</p>}

      {isLoading ? (
        <div className="transactions-page__loading">Loading transactions…</div>
      ) : transactions.length === 0 ? (
        <div className="transactions-page__empty">
          No transactions found.
          {hasActiveFilters && ' Try clearing the filters.'}
        </div>
      ) : (
        <Card className="transactions-page__table-wrapper" padding="none">
          <table className="transactions-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Account</th>
                <th>Payee</th>
                <th>Date</th>
                <th>Type</th>
                <th className="transactions-table__amount-col">Amount</th>
                <th>Category</th>
                <th>Classification</th>
                <th>Note</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const isDeposit = tx.transaction_type === TransactionType.Deposit
                const isWithdraw = tx.transaction_type === TransactionType.Withdraw
                const amountClass = isDeposit
                  ? 'transactions-table__amount transactions-table__amount--deposit'
                  : isWithdraw
                    ? 'transactions-table__amount transactions-table__amount--withdraw'
                    : 'transactions-table__amount transactions-table__amount--transfer'
                const amountPrefix = isDeposit ? '+' : isWithdraw ? '−' : ''

                return (
                  <tr key={tx.transaction_id} className="transactions-table__row">
                    <td className="transactions-table__id">{tx.transaction_id}</td>
                    <td>{accountMap.get(tx.account_id) ?? tx.account_id}</td>
                    <td>
                      {tx.payee ? (
                        tx.payee
                      ) : (
                        <span className="transactions-table__empty-cell">—</span>
                      )}
                    </td>
                    <td>{formatDate(tx.transaction_date)}</td>
                    <td><Tag>{tx.transaction_type}</Tag></td>
                    <td className={amountClass}>
                      {amountPrefix}{formatCurrency(tx.amount)}
                    </td>
                    <td>
                      {tx.category_id ? (
                        categoryMap.get(tx.category_id) ?? tx.category_id
                      ) : (
                        <span className="transactions-table__empty-cell">—</span>
                      )}
                    </td>
                    <td>{capitalize(tx.classification)}</td>
                    <td>
                      {tx.note ? (
                        <span className="transactions-table__note" title={tx.note}>
                          {tx.note}
                        </span>
                      ) : (
                        <span className="transactions-table__empty-cell">—</span>
                      )}
                    </td>
                    <td className="transactions-table__actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="transactions-table__btn-edit"
                        onClick={() => handleEditClick(tx)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        className="transactions-table__btn-delete"
                        onClick={() => handleDeleteClick(tx)}
                      >
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
        <TransactionDialog
          mode={dialogMode}
          transaction={selectedTransaction}
          accounts={accounts}
          categories={categories}
          onClose={handleDialogClose}
          onSaved={handleDialogSaved}
        />
      )}
    </div>
  )
}
