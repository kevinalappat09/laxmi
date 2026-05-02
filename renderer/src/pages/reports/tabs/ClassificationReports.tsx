import { useMemo } from 'react'
import { TransactionType, type Transaction } from '../../../../../src/types/transaction'
import { aggregateByKey } from '../../../utils/chartUtils'
import { buildPieOption } from '../../../utils/reportOptions'
import { ReportChartCard } from '../components/ReportChartCard'

interface ClassificationReportsProps {
  transactions: Transaction[]
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function ClassificationReports({ transactions }: ClassificationReportsProps) {
  const expenseData = useMemo(
    () => aggregateByKey(transactions, (tx) => capitalize(tx.classification), TransactionType.Withdraw),
    [transactions]
  )
  const expenseOption = useMemo(() => buildPieOption(expenseData), [expenseData])

  return (
    <div className="reports-page__charts">
      <ReportChartCard
        title="Classification Expense Breakdown"
        subtitle="Expense distribution by classification"
        option={expenseOption}
        hasData={expenseData.length > 0}
      />
    </div>
  )
}
