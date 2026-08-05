import { useMemo, useState } from 'react'
import type { Category } from '../../../../../../src/types/category'
import { TransactionType, type Transaction } from '../../../../../../src/types/transaction'
import { Button } from '../../../../components/ui/Button'
import { Select } from '../../../../components/ui/Input'
import { MultiSelectDropdown } from '../../../../components/ui/MultiSelectDropdown'
import {
  aggregateByKey,
  collapsePivotToTopN,
  collapseToTopN,
  getAutoAggregateBuckets,
  pivotByKey,
} from '../../../../utils/chartUtils'
import {
  assignSeriesColors,
  buildMultiLineOption,
  buildPieOption,
  mergeSeriesKeys,
} from '../../../../utils/reportOptions'
import { ReportChartCard } from '../../components/ReportChartCard'

interface CategoryTabProps {
  transactions: Transaction[]
  categories: Category[]
  fromDate: Date
  toDate: Date
}

function buildDescendantIdSet(
  parentId: number,
  childrenByParent: Map<number, number[]>
): Set<number> {
  const descendantIds = new Set<number>()
  const queue = [...(childrenByParent.get(parentId) ?? [])]

  while (queue.length > 0) {
    const currentId = queue.shift()
    if (currentId === undefined || descendantIds.has(currentId)) continue

    descendantIds.add(currentId)
    const childIds = childrenByParent.get(currentId) ?? []
    childIds.forEach((childId) => queue.push(childId))
  }

  return descendantIds
}

export function CategoryTab({ transactions, categories, fromDate, toDate }: CategoryTabProps) {
  const [selectedParentId, setSelectedParentId] = useState<'all' | number>('all')
  const [selectedLeafIds, setSelectedLeafIds] = useState<Set<number> | null>(null)

  const categoriesWithId = useMemo(
    () => categories.filter((category): category is Category & { category_id: number } => category.category_id !== undefined),
    [categories]
  )

  const childrenByParent = useMemo(() => {
    const map = new Map<number, number[]>()

    categoriesWithId.forEach((category) => {
      if (category.parent_category_id === undefined) return
      const existing = map.get(category.parent_category_id) ?? []
      map.set(category.parent_category_id, [...existing, category.category_id])
    })

    return map
  }, [categoriesWithId])

  const leafCategories = useMemo(
    () => categoriesWithId.filter((category) => !childrenByParent.has(category.category_id)),
    [categoriesWithId, childrenByParent]
  )

  const parentOptions = useMemo(
    () =>
      categoriesWithId
        .filter((category) => childrenByParent.has(category.category_id))
        .map((category) => ({
          value: String(category.category_id),
          label: category.category_name,
        })),
    [categoriesWithId, childrenByParent]
  )

  const scopedLeafCategories = useMemo(() => {
    if (selectedParentId === 'all') return leafCategories

    const descendants = buildDescendantIdSet(selectedParentId, childrenByParent)
    return leafCategories.filter((category) => descendants.has(category.category_id))
  }, [selectedParentId, leafCategories, childrenByParent])

  const leafOptions = useMemo(
    () =>
      scopedLeafCategories.map((category) => ({
        value: String(category.category_id),
        label: category.category_name,
      })),
    [scopedLeafCategories]
  )

  const allowedLeafIdSet = useMemo(() => {
    const scopedIds = scopedLeafCategories.map((category) => category.category_id)
    if (!selectedLeafIds) return new Set(scopedIds)
    return new Set(scopedIds.filter((id) => selectedLeafIds.has(id)))
  }, [scopedLeafCategories, selectedLeafIds])

  const leafNameById = useMemo(
    () => new Map(leafCategories.map((category) => [category.category_id, category.category_name])),
    [leafCategories]
  )

  const resolveLeafName = useMemo(
    () => (transaction: Transaction) => {
      if (!transaction.category_id || !allowedLeafIdSet.has(transaction.category_id)) return null
      return leafNameById.get(transaction.category_id) ?? null
    },
    [allowedLeafIdSet, leafNameById]
  )

  const buckets = useMemo(() => getAutoAggregateBuckets(fromDate, toDate), [fromDate, toDate])

  const expenseData = useMemo(
    () => collapseToTopN(aggregateByKey(transactions, resolveLeafName, TransactionType.Withdraw)),
    [transactions, resolveLeafName]
  )

  const incomeData = useMemo(
    () => collapseToTopN(aggregateByKey(transactions, resolveLeafName, TransactionType.Deposit)),
    [transactions, resolveLeafName]
  )

  const expensePivot = useMemo(
    () => collapsePivotToTopN(pivotByKey(transactions, buckets, resolveLeafName, TransactionType.Withdraw)),
    [transactions, buckets, resolveLeafName]
  )

  const incomePivot = useMemo(
    () => collapsePivotToTopN(pivotByKey(transactions, buckets, resolveLeafName, TransactionType.Deposit)),
    [transactions, buckets, resolveLeafName]
  )

  const colorMap = useMemo(
    () =>
      assignSeriesColors(
        mergeSeriesKeys(
          expenseData.map((point) => point.name),
          expensePivot.seriesKeys,
          incomeData.map((point) => point.name),
          incomePivot.seriesKeys
        )
      ),
    [expenseData, expensePivot, incomeData, incomePivot]
  )

  const expenseOption = useMemo(() => buildPieOption(expenseData, colorMap), [expenseData, colorMap])
  const incomeOption = useMemo(() => buildPieOption(incomeData, colorMap), [incomeData, colorMap])
  const expenseTrendOption = useMemo(
    () => buildMultiLineOption(expensePivot.data, expensePivot.seriesKeys, colorMap),
    [expensePivot, colorMap]
  )
  const incomeTrendOption = useMemo(
    () => buildMultiLineOption(incomePivot.data, incomePivot.seriesKeys, colorMap),
    [incomePivot, colorMap]
  )

  return (
    <>
      <div className="reports-page__tab-filters">
        <Select
          id="reports-category-parent-filter"
          label="Parent category"
          className="reports-page__field"
          value={selectedParentId === 'all' ? 'all' : String(selectedParentId)}
          onChange={(e) => {
            const value = e.target.value
            setSelectedParentId(value === 'all' ? 'all' : Number(value))
            setSelectedLeafIds(null)
          }}
        >
          <option value="all">All parents</option>
          {parentOptions.map((parent) => (
            <option key={parent.value} value={parent.value}>
              {parent.label}
            </option>
          ))}
        </Select>

        <div className="reports-page__field-actions">
          <MultiSelectDropdown
            id="reports-category-leaf-filter"
            label="Categories"
            className="reports-page__field reports-page__field-actions-control"
            options={leafOptions}
            selectedValues={
              selectedLeafIds
                ? leafOptions.map((option) => option.value).filter((value) => selectedLeafIds.has(Number(value)))
                : leafOptions.map((option) => option.value)
            }
            onChange={(values) => {
              const next = new Set(values.map(Number))
              setSelectedLeafIds(next.size === leafOptions.length ? null : next)
            }}
            placeholder="No categories"
            allSelectedLabel="All categories"
            disabled={leafOptions.length === 0}
          />
          <div className="reports-page__field-actions-buttons">
            <Button
              variant="subtle"
              size="sm"
              onClick={() => setSelectedLeafIds(null)}
              disabled={leafOptions.length === 0}
            >
              All
            </Button>
            <Button
              variant="subtle"
              size="sm"
              onClick={() => setSelectedLeafIds(new Set())}
              disabled={leafOptions.length === 0}
            >
              None
            </Button>
          </div>
        </div>
      </div>

      <div className="reports-page__charts">
        <ReportChartCard
          title="Where You Spend"
          subtitle="Expense distribution by leaf category"
          option={expenseOption}
          hasData={expenseData.length > 0}
        />
        <ReportChartCard
          title="Where You Make Money"
          subtitle="Income distribution by leaf category"
          option={incomeOption}
          hasData={incomeData.length > 0}
        />
        <ReportChartCard
          title="Category Expense Trend"
          subtitle="Expense lines grouped by category"
          option={expenseTrendOption}
          hasData={expensePivot.seriesKeys.length > 0}
        />
        <ReportChartCard
          title="Category Income Trend"
          subtitle="Income lines grouped by category"
          option={incomeTrendOption}
          hasData={incomePivot.seriesKeys.length > 0}
        />
      </div>
    </>
  )
}
