import { useEffect, useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import ReactECharts from 'echarts-for-react'
import type { Account } from '../../../../src/types/account'
import type { Category } from '../../../../src/types/category'
import { Classification, TransactionType, type Transaction } from '../../../../src/types/transaction'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Select } from '../../components/ui/Input'
import { MultiSelectDropdown } from '../../components/ui/MultiSelectDropdown'
import {
  CLASSIFICATION_OPTIONS,
  bucketTransactions,
  bucketTransactionsDual,
  getAutoAggregateBuckets,
  getDateRangeForPreset,
  pivotByKey,
  type DateRangePreset,
} from '../../utils/chartUtils'
import './ReportsPage.css'

const SERIES_COLORS = ['#479ffa', '#d6fe51', '#4ebe96', '#ffa16c', '#b6d6ff', '#a3e4cb', '#ffd4b3', '#c3b1e1']
const INCOME_COLOR = '#4ebe96'
const EXPENSE_COLOR = '#ffa16c'
const GRID_COLOR = 'rgba(255, 255, 255, 0.06)'
const AXIS_TEXT_COLOR = '#868f97'
const TOOLTIP_BG = '#191919'
const TOOLTIP_BORDER = '#2a2a2a'
const PLACEHOLDER_CATEGORY = 'Uncategorized'

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

function baseOption(): EChartsOption {
  return {
    animation: true,
    color: SERIES_COLORS,
    tooltip: {
      trigger: 'axis',
      backgroundColor: TOOLTIP_BG,
      borderColor: TOOLTIP_BORDER,
      textStyle: {
        color: '#e6e6e6',
        fontFamily: 'calibre, Inter, sans-serif',
      },
    },
    grid: { left: 20, right: 20, top: 20, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      axisLine: { lineStyle: { color: GRID_COLOR } },
      axisLabel: { color: AXIS_TEXT_COLOR },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: GRID_COLOR } },
      axisLabel: { color: AXIS_TEXT_COLOR },
    },
  }
}

function buildSingleBarOption(data: Array<{ label: string; value: number }>): EChartsOption {
  return {
    ...baseOption(),
    xAxis: {
      ...(baseOption().xAxis as object),
      data: data.map((item) => item.label),
    },
    series: [
      {
        type: 'bar',
        name: 'Expense',
        data: data.map((item) => item.value),
        itemStyle: { color: EXPENSE_COLOR, borderRadius: [4, 4, 0, 0] },
      },
    ],
  }
}

function buildIncomeExpenseOption(data: Array<{ label: string; income: number; expense: number }>): EChartsOption {
  return {
    ...baseOption(),
    legend: {
      top: 0,
      textStyle: { color: AXIS_TEXT_COLOR },
    },
    xAxis: {
      ...(baseOption().xAxis as object),
      data: data.map((item) => item.label),
    },
    series: [
      {
        type: 'bar',
        name: 'Income',
        data: data.map((item) => item.income),
        itemStyle: { color: INCOME_COLOR, borderRadius: [4, 4, 0, 0] },
      },
      {
        type: 'bar',
        name: 'Expense',
        data: data.map((item) => item.expense),
        itemStyle: { color: EXPENSE_COLOR, borderRadius: [4, 4, 0, 0] },
      },
    ],
  }
}

function buildMultiLineOption(
  data: Array<{ label: string } & Record<string, number | string>>,
  seriesKeys: string[]
): EChartsOption {
  return {
    ...baseOption(),
    legend: {
      top: 0,
      textStyle: { color: AXIS_TEXT_COLOR },
    },
    xAxis: {
      ...(baseOption().xAxis as object),
      data: data.map((row) => row.label),
    },
    series: seriesKeys.map((key, index) => ({
      type: 'line',
      name: key,
      smooth: true,
      symbolSize: 6,
      lineStyle: {
        width: 2,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
      },
      itemStyle: {
        color: SERIES_COLORS[index % SERIES_COLORS.length],
      },
      data: data.map((row) => (typeof row[key] === 'number' ? (row[key] as number) : 0)),
    })),
  }
}

interface ChartCardProps {
  title: string
  subtitle: string
  option: EChartsOption
  hasData: boolean
}

function ChartCard({ title, subtitle, option, hasData }: ChartCardProps) {
  return (
    <Card className="reports-page__chart-card">
      <div className="reports-page__chart-header">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {hasData ? (
        <ReactECharts option={option} style={{ height: 280, width: '100%' }} />
      ) : (
        <div className="reports-page__chart-empty">No data for selected filters.</div>
      )}
    </Card>
  )
}

export function ReportsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [datePreset, setDatePreset] = useState<DateRangePreset>('current-month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number>>(new Set())
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set())
  const [selectedClassifications, setSelectedClassifications] = useState<Set<Classification>>(
    () => new Set(CLASSIFICATION_OPTIONS)
  )

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
        setSelectedAccountIds(new Set(loadedAccounts.map((account) => account.account_id)))
        setSelectedCategoryIds(
          new Set(loadedCategories.map((category) => category.category_id).filter((id): id is number => id !== undefined))
        )
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

    const shouldRequireCategorySelection = categories.length > 0
    const isSelectionValid =
      selectedAccountIds.size > 0 &&
      selectedClassifications.size > 0 &&
      (!shouldRequireCategorySelection || selectedCategoryIds.size > 0)

    async function loadTransactions() {
      setIsLoading(true)
      setError(null)
      try {
        if (!isSelectionValid) {
          setTransactions([])
          return
        }

        const accountsToQuery = accounts.filter((account) => selectedAccountIds.has(account.account_id))
        if (accountsToQuery.length === 0) {
          setTransactions([])
          return
        }

        const shouldFilterCategories =
          categories.length > 0 && selectedCategoryIds.size > 0 && selectedCategoryIds.size < categories.length
        const shouldFilterClassifications =
          selectedClassifications.size > 0 && selectedClassifications.size < CLASSIFICATION_OPTIONS.length

        const results = await Promise.all(
          accountsToQuery.map((account) => {
            const query: {
              accountId: number
              fromDate: Date
              toDate: Date
              categoryIds?: Set<number>
              classifications?: Set<Classification>
            } = {
              accountId: account.account_id,
              fromDate: activeRange.from,
              toDate: activeRange.to,
            }
            if (shouldFilterCategories) {
              query.categoryIds = new Set(selectedCategoryIds)
            }
            if (shouldFilterClassifications) {
              query.classifications = new Set(selectedClassifications)
            }
            return window.financeAPI.findTransactionsWithFilter(query)
          })
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
  }, [accounts, categories, activeRange.from, activeRange.to, selectedAccountIds, selectedCategoryIds, selectedClassifications])

  const categoryNameById = useMemo(
    () =>
      new Map(
        categories
          .filter((category): category is Category & { category_id: number } => category.category_id !== undefined)
          .map((category) => [category.category_id, category.category_name])
      ),
    [categories]
  )

  const buckets = useMemo(
    () => getAutoAggregateBuckets(activeRange.from, activeRange.to),
    [activeRange.from, activeRange.to]
  )

  const expenseBarData = useMemo(
    () => bucketTransactions(transactions, buckets, TransactionType.Withdraw),
    [transactions, buckets]
  )
  const incomeExpenseData = useMemo(
    () => bucketTransactionsDual(transactions, buckets),
    [transactions, buckets]
  )
  const categoryExpensePivot = useMemo(
    () =>
      pivotByKey(
        transactions,
        buckets,
        (tx) => {
          if (!tx.category_id) return null
          return categoryNameById.get(tx.category_id) ?? PLACEHOLDER_CATEGORY
        },
        TransactionType.Withdraw
      ),
    [transactions, buckets, categoryNameById]
  )
  const categoryIncomePivot = useMemo(
    () =>
      pivotByKey(
        transactions,
        buckets,
        (tx) => {
          if (!tx.category_id) return null
          return categoryNameById.get(tx.category_id) ?? PLACEHOLDER_CATEGORY
        },
        TransactionType.Deposit
      ),
    [transactions, buckets, categoryNameById]
  )
  const classificationExpensePivot = useMemo(
    () =>
      pivotByKey(
        transactions,
        buckets,
        (tx) => capitalize(tx.classification),
        TransactionType.Withdraw
      ),
    [transactions, buckets]
  )
  const classificationIncomePivot = useMemo(
    () =>
      pivotByKey(
        transactions,
        buckets,
        (tx) => capitalize(tx.classification),
        TransactionType.Deposit
      ),
    [transactions, buckets]
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

  const hasAnyData = transactions.length > 0
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

          <div className="reports-page__field-actions">
            <MultiSelectDropdown
              id="reports-account-filter"
              label="Account"
              className="reports-page__field reports-page__field-actions-control"
              options={accountOptions}
              selectedValues={Array.from(selectedAccountIds, String)}
              onChange={(values) => setSelectedAccountIds(new Set(values.map(Number)))}
              placeholder="All accounts"
              allSelectedLabel="All accounts"
              disabled={accountOptions.length === 0}
            />
            <div className="reports-page__field-actions-buttons">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setSelectedAccountIds(new Set(accounts.map((account) => account.account_id)))}
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
              id="reports-category-filter"
              label="Category"
              className="reports-page__field reports-page__field-actions-control"
              options={categoryOptions}
              selectedValues={Array.from(selectedCategoryIds, String)}
              onChange={(values) => setSelectedCategoryIds(new Set(values.map(Number)))}
              placeholder="All categories"
              allSelectedLabel="All categories"
              disabled={categoryOptions.length === 0}
            />
            <div className="reports-page__field-actions-buttons">
              <Button
                variant="subtle"
                size="sm"
                onClick={() =>
                  setSelectedCategoryIds(
                    new Set(
                      categories
                        .map((category) => category.category_id)
                        .filter((id): id is number => id !== undefined)
                    )
                  )
                }
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
              id="reports-classification-filter"
              label="Classification"
              className="reports-page__field reports-page__field-actions-control"
              options={classificationOptions}
              selectedValues={Array.from(selectedClassifications)}
              onChange={(values) => setSelectedClassifications(new Set(values as Classification[]))}
              placeholder="All classifications"
              allSelectedLabel="All classifications"
            />
            <div className="reports-page__field-actions-buttons">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setSelectedClassifications(new Set(CLASSIFICATION_OPTIONS))}
              >
                All
              </Button>
              <Button variant="subtle" size="sm" onClick={() => setSelectedClassifications(new Set())}>
                None
              </Button>
            </div>
          </div>

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
        </div>

      </Card>

      {error && <p className="reports-page__error">{error}</p>}
      {isLoading && <p className="reports-page__loading">Loading report data…</p>}

      <div className="reports-page__charts">
        <ChartCard
          title="Expense Over Time"
          subtitle="Auto-aggregated by selected date range"
          option={expenseChartOption}
          hasData={hasAnyData}
        />
        <ChartCard
          title="Income vs Expense"
          subtitle="Clustered comparison per time bucket"
          option={incomeVsExpenseOption}
          hasData={hasAnyData}
        />
        <ChartCard
          title="Category Expense Trend"
          subtitle="Expense lines grouped by category"
          option={categoryExpenseOption}
          hasData={categoryExpensePivot.seriesKeys.length > 0}
        />
        <ChartCard
          title="Category Income Trend"
          subtitle="Income lines grouped by category"
          option={categoryIncomeOption}
          hasData={categoryIncomePivot.seriesKeys.length > 0}
        />
        <ChartCard
          title="Classification Expense Trend"
          subtitle="Expense lines by classification"
          option={classificationExpenseOption}
          hasData={classificationExpensePivot.seriesKeys.length > 0}
        />
        <ChartCard
          title="Classification Income Trend"
          subtitle="Income lines by classification"
          option={classificationIncomeOption}
          hasData={classificationIncomePivot.seriesKeys.length > 0}
        />
      </div>
    </div>
  )
}
