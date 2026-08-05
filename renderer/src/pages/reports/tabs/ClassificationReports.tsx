import { useMemo } from 'react'
import { TransactionType, type Transaction } from '../../../../../src/types/transaction'
import {
  aggregateByKey,
  collapsePivotToTopN,
  collapseToTopN,
  getAutoAggregateBuckets,
  pivotByKey,
} from '../../../utils/chartUtils'
import {
  assignSeriesColors,
  buildMultiLineOption,
  buildPieOption,
  mergeSeriesKeys,
} from '../../../utils/reportOptions'
import { ReportChartCard } from '../components/ReportChartCard'

interface ClassificationReportsProps {
  transactions: Transaction[]
  fromDate: Date
  toDate: Date
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function resolveClassificationName(transaction: Transaction): string {
  return capitalize(transaction.classification)
}

export function ClassificationReports({ transactions, fromDate, toDate }: ClassificationReportsProps) {
  const buckets = useMemo(() => getAutoAggregateBuckets(fromDate, toDate), [fromDate, toDate])

  const expenseData = useMemo(
    () => collapseToTopN(aggregateByKey(transactions, resolveClassificationName, TransactionType.Withdraw)),
    [transactions]
  )

  const expensePivot = useMemo(
    () =>
      collapsePivotToTopN(
        pivotByKey(transactions, buckets, resolveClassificationName, TransactionType.Withdraw)
      ),
    [transactions, buckets]
  )

  const colorMap = useMemo(
    () =>
      assignSeriesColors(
        mergeSeriesKeys(
          expenseData.map((point) => point.name),
          expensePivot.seriesKeys
        )
      ),
    [expenseData, expensePivot]
  )

  const expenseOption = useMemo(() => buildPieOption(expenseData, colorMap), [expenseData, colorMap])
  const expenseTrendOption = useMemo(
    () => buildMultiLineOption(expensePivot.data, expensePivot.seriesKeys, colorMap),
    [expensePivot, colorMap]
  )

  return (
    <div className="reports-page__charts">
      <ReportChartCard
        title="Classification Expense Breakdown"
        subtitle="Expense distribution by classification"
        option={expenseOption}
        hasData={expenseData.length > 0}
      />
      <ReportChartCard
        title="Classification Expense Trend"
        subtitle="Expense lines by classification"
        option={expenseTrendOption}
        hasData={expensePivot.seriesKeys.length > 0}
      />
    </div>
  )
}
