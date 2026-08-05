import { useMemo } from 'react'
import type { Transaction } from '../../../../../src/types/transaction'
import { bucketTransactionsDual, getAutoAggregateBuckets } from '../../../utils/chartUtils'
import { buildIncomeExpenseOption } from '../../../utils/reportOptions'
import { ReportChartCard } from '../components/ReportChartCard'

interface TemporalReportsProps {
  transactions: Transaction[]
  fromDate: Date
  toDate: Date
}

export function TemporalReports({ transactions, fromDate, toDate }: TemporalReportsProps) {
  const buckets = useMemo(() => getAutoAggregateBuckets(fromDate, toDate), [fromDate, toDate])

  const incomeExpenseData = useMemo(
    () => bucketTransactionsDual(transactions, buckets),
    [transactions, buckets]
  )

  const incomeVsExpenseOption = useMemo(
    () => buildIncomeExpenseOption(incomeExpenseData),
    [incomeExpenseData]
  )

  return (
    <div className="reports-page__charts">
      <ReportChartCard
        title="Income vs Expense"
        subtitle="Clustered comparison per time bucket"
        option={incomeVsExpenseOption}
        hasData={transactions.length > 0}
      />
    </div>
  )
}
