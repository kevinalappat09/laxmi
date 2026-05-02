import { useMemo, useState } from 'react'
import type { Account } from '../../../../../src/types/account'
import type { Category } from '../../../../../src/types/category'
import { Classification, TransactionType, type Transaction } from '../../../../../src/types/transaction'
import { Button } from '../../../components/ui/Button'
import { MultiSelectDropdown } from '../../../components/ui/MultiSelectDropdown'
import {
  CLASSIFICATION_OPTIONS,
  bucketTransactions,
  bucketTransactionsDual,
  getAutoAggregateBuckets,
  pivotByKey,
} from '../../../utils/chartUtils'
import { buildIncomeExpenseOption, buildMultiLineOption, buildSingleBarOption } from '../../../utils/reportOptions'
import { ReportChartCard } from '../components/ReportChartCard'

const PLACEHOLDER_CATEGORY = 'Uncategorized'

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

interface TemporalReportsProps {
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
  fromDate: Date
  toDate: Date
}

export function TemporalReports({ transactions, accounts, categories, fromDate, toDate }: TemporalReportsProps) {
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number> | null>(null)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number> | null>(null)
  const [selectedClassifications, setSelectedClassifications] = useState<Set<Classification> | null>(null)

  const allAccountIds = useMemo(() => accounts.map((account) => account.account_id), [accounts])
  const allCategoryIds = useMemo(
    () => categories.map((category) => category.category_id).filter((id): id is number => id !== undefined),
    [categories]
  )
  const allClassifications = CLASSIFICATION_OPTIONS

  const categoryNameById = useMemo(
    () =>
      new Map(
        categories
          .filter((category): category is Category & { category_id: number } => category.category_id !== undefined)
          .map((category) => [category.category_id, category.category_name])
      ),
    [categories]
  )

  const filteredTransactions = useMemo(() => {
    const shouldRequireCategorySelection = categories.length > 0
    const activeAccountIds = selectedAccountIds ?? new Set(allAccountIds)
    const activeCategoryIds = selectedCategoryIds ?? new Set(allCategoryIds)
    const activeClassifications = selectedClassifications ?? new Set(allClassifications)

    const isSelectionValid =
      activeAccountIds.size > 0 &&
      activeClassifications.size > 0 &&
      (!shouldRequireCategorySelection || activeCategoryIds.size > 0)

    if (!isSelectionValid) {
      return []
    }

    return transactions.filter((tx) => {
      if (!activeAccountIds.has(tx.account_id)) return false
      if (!activeClassifications.has(tx.classification)) return false

      if (categories.length > 0) {
        if (!tx.category_id) return false
        if (!activeCategoryIds.has(tx.category_id)) return false
      }

      return true
    })
  }, [
    transactions,
    categories,
    selectedAccountIds,
    selectedCategoryIds,
    selectedClassifications,
    allAccountIds,
    allCategoryIds,
    allClassifications,
  ])

  const buckets = useMemo(() => getAutoAggregateBuckets(fromDate, toDate), [fromDate, toDate])

  const expenseBarData = useMemo(
    () => bucketTransactions(filteredTransactions, buckets, TransactionType.Withdraw),
    [filteredTransactions, buckets]
  )
  const incomeExpenseData = useMemo(
    () => bucketTransactionsDual(filteredTransactions, buckets),
    [filteredTransactions, buckets]
  )
  const categoryExpensePivot = useMemo(
    () =>
      pivotByKey(
        filteredTransactions,
        buckets,
        (tx) => {
          if (!tx.category_id) return null
          return categoryNameById.get(tx.category_id) ?? PLACEHOLDER_CATEGORY
        },
        TransactionType.Withdraw
      ),
    [filteredTransactions, buckets, categoryNameById]
  )
  const categoryIncomePivot = useMemo(
    () =>
      pivotByKey(
        filteredTransactions,
        buckets,
        (tx) => {
          if (!tx.category_id) return null
          return categoryNameById.get(tx.category_id) ?? PLACEHOLDER_CATEGORY
        },
        TransactionType.Deposit
      ),
    [filteredTransactions, buckets, categoryNameById]
  )
  const classificationExpensePivot = useMemo(
    () =>
      pivotByKey(
        filteredTransactions,
        buckets,
        (tx) => capitalize(tx.classification),
        TransactionType.Withdraw
      ),
    [filteredTransactions, buckets]
  )
  const classificationIncomePivot = useMemo(
    () =>
      pivotByKey(
        filteredTransactions,
        buckets,
        (tx) => capitalize(tx.classification),
        TransactionType.Deposit
      ),
    [filteredTransactions, buckets]
  )

  const expenseChartOption = useMemo(() => buildSingleBarOption(expenseBarData), [expenseBarData])
  const incomeVsExpenseOption = useMemo(() => buildIncomeExpenseOption(incomeExpenseData), [incomeExpenseData])
  const categoryExpenseOption = useMemo(
    () => buildMultiLineOption(categoryExpensePivot.data, categoryExpensePivot.seriesKeys),
    [categoryExpensePivot]
  )
  const categoryIncomeOption = useMemo(
    () => buildMultiLineOption(categoryIncomePivot.data, categoryIncomePivot.seriesKeys),
    [categoryIncomePivot]
  )
  const classificationExpenseOption = useMemo(
    () => buildMultiLineOption(classificationExpensePivot.data, classificationExpensePivot.seriesKeys),
    [classificationExpensePivot]
  )
  const classificationIncomeOption = useMemo(
    () => buildMultiLineOption(classificationIncomePivot.data, classificationIncomePivot.seriesKeys),
    [classificationIncomePivot]
  )

  const hasAnyData = filteredTransactions.length > 0
  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: String(account.account_id),
        label: account.account_name,
      })),
    [accounts]
  )
  const categoryOptions = useMemo(
    () =>
      categories
        .filter((category): category is Category & { category_id: number } => category.category_id !== undefined)
        .map((category) => ({
          value: String(category.category_id),
          label: category.category_name,
        })),
    [categories]
  )
  const classificationOptions = useMemo(
    () =>
      CLASSIFICATION_OPTIONS.map((classification) => ({
        value: classification,
        label: capitalize(classification),
      })),
    []
  )

  return (
    <>
      <div className="reports-page__filter-grid">
        <div className="reports-page__field-actions">
          <MultiSelectDropdown
            id="reports-temporal-account-filter"
            label="Account"
            className="reports-page__field reports-page__field-actions-control"
            options={accountOptions}
            selectedValues={selectedAccountIds ? Array.from(selectedAccountIds, String) : accountOptions.map((item) => item.value)}
            onChange={(values) => {
              const next = new Set(values.map(Number))
              setSelectedAccountIds(next.size === allAccountIds.length ? null : next)
            }}
            placeholder="All accounts"
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
            id="reports-temporal-category-filter"
            label="Category"
            className="reports-page__field reports-page__field-actions-control"
            options={categoryOptions}
            selectedValues={selectedCategoryIds ? Array.from(selectedCategoryIds, String) : categoryOptions.map((item) => item.value)}
            onChange={(values) => {
              const next = new Set(values.map(Number))
              setSelectedCategoryIds(next.size === allCategoryIds.length ? null : next)
            }}
            placeholder="All categories"
            allSelectedLabel="All categories"
            disabled={categoryOptions.length === 0}
          />
          <div className="reports-page__field-actions-buttons">
            <Button
              variant="subtle"
              size="sm"
              onClick={() => setSelectedCategoryIds(null)}
              disabled={categoryOptions.length === 0}
            >
              All
            </Button>
            <Button
              variant="subtle"
              size="sm"
              onClick={() => setSelectedCategoryIds(new Set())}
              disabled={categoryOptions.length === 0}
            >
              None
            </Button>
          </div>
        </div>

        <div className="reports-page__field-actions">
          <MultiSelectDropdown
            id="reports-temporal-classification-filter"
            label="Classification"
            className="reports-page__field reports-page__field-actions-control"
            options={classificationOptions}
            selectedValues={selectedClassifications ? Array.from(selectedClassifications) : allClassifications}
            onChange={(values) => {
              const next = new Set(values as Classification[])
              setSelectedClassifications(next.size === allClassifications.length ? null : next)
            }}
            placeholder="All classifications"
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

      <div className="reports-page__charts">
        <ReportChartCard
          title="Expense Over Time"
          subtitle="Auto-aggregated by selected date range"
          option={expenseChartOption}
          hasData={hasAnyData}
        />
        <ReportChartCard
          title="Income vs Expense"
          subtitle="Clustered comparison per time bucket"
          option={incomeVsExpenseOption}
          hasData={hasAnyData}
        />
        <ReportChartCard
          title="Category Expense Trend"
          subtitle="Expense lines grouped by category"
          option={categoryExpenseOption}
          hasData={categoryExpensePivot.seriesKeys.length > 0}
        />
        <ReportChartCard
          title="Category Income Trend"
          subtitle="Income lines grouped by category"
          option={categoryIncomeOption}
          hasData={categoryIncomePivot.seriesKeys.length > 0}
        />
        <ReportChartCard
          title="Classification Expense Trend"
          subtitle="Expense lines by classification"
          option={classificationExpenseOption}
          hasData={classificationExpensePivot.seriesKeys.length > 0}
        />
        <ReportChartCard
          title="Classification Income Trend"
          subtitle="Income lines by classification"
          option={classificationIncomeOption}
          hasData={classificationIncomePivot.seriesKeys.length > 0}
        />
      </div>
    </>
  )
}
