import { useMemo, useState } from 'react'
import type { Category } from '../../../../../src/types/category'
import { TransactionType, type Transaction } from '../../../../../src/types/transaction'
import { Select } from '../../../components/ui/Input'
import { aggregateByKey } from '../../../utils/chartUtils'
import { buildPieOption } from '../../../utils/reportOptions'
import { ReportChartCard } from '../components/ReportChartCard'

interface CategoryReportsProps {
  transactions: Transaction[]
  categories: Category[]
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

export function CategoryReports({ transactions, categories }: CategoryReportsProps) {
  const [selectedParentId, setSelectedParentId] = useState<'all' | number>('all')

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

  const allowedLeafIdSet = useMemo(() => {
    if (selectedParentId === 'all') {
      return new Set(leafCategories.map((category) => category.category_id))
    }

    const descendants = buildDescendantIdSet(selectedParentId, childrenByParent)
    const leafIds = leafCategories
      .map((category) => category.category_id)
      .filter((leafId) => descendants.has(leafId))

    return new Set(leafIds)
  }, [selectedParentId, leafCategories, childrenByParent])

  const leafNameById = useMemo(
    () => new Map(leafCategories.map((category) => [category.category_id, category.category_name])),
    [leafCategories]
  )

  const expenseData = useMemo(
    () =>
      aggregateByKey(
        transactions,
        (tx) => {
          if (!tx.category_id || !allowedLeafIdSet.has(tx.category_id)) return null
          return leafNameById.get(tx.category_id) ?? null
        },
        TransactionType.Withdraw
      ),
    [transactions, allowedLeafIdSet, leafNameById]
  )

  const incomeData = useMemo(
    () =>
      aggregateByKey(
        transactions,
        (tx) => {
          if (!tx.category_id || !allowedLeafIdSet.has(tx.category_id)) return null
          return leafNameById.get(tx.category_id) ?? null
        },
        TransactionType.Deposit
      ),
    [transactions, allowedLeafIdSet, leafNameById]
  )

  const expenseOption = useMemo(() => buildPieOption(expenseData), [expenseData])
  const incomeOption = useMemo(() => buildPieOption(incomeData), [incomeData])

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
          }}
        >
          <option value="all">All parents</option>
          {parentOptions.map((parent) => (
            <option key={parent.value} value={parent.value}>
              {parent.label}
            </option>
          ))}
        </Select>
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
      </div>
    </>
  )
}
