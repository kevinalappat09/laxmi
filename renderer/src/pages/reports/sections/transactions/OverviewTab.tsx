import { useMemo } from 'react'
import type { PortfolioTransaction } from '../../../../../../src/types/portfolioTransaction'
import type { Transaction } from '../../../../../../src/types/transaction'
import { bucketTransactionsDual, getAutoAggregateBuckets } from '../../../../utils/chartUtils'
import {
  buildDivergingBarOption,
  buildIncomeExpenseOption,
  buildPercentLineOption,
} from '../../../../utils/reportOptions'
import { bucketSavings } from '../../../../utils/savingsUtils'
import { ReportChartCard } from '../../components/ReportChartCard'

interface OverviewTabProps {
  transactions: Transaction[]
  portfolioTransactions: PortfolioTransaction[]
  fromDate: Date
  toDate: Date
}

export function OverviewTab({
  transactions,
  portfolioTransactions,
  fromDate,
  toDate,
}: OverviewTabProps) {
  const buckets = useMemo(() => getAutoAggregateBuckets(fromDate, toDate), [fromDate, toDate])

  const incomeExpenseData = useMemo(
    () => bucketTransactionsDual(transactions, buckets),
    [transactions, buckets]
  )

  const savingsPoints = useMemo(
    () => bucketSavings(transactions, portfolioTransactions, buckets),
    [transactions, portfolioTransactions, buckets]
  )

  const incomeVsExpenseOption = useMemo(
    () => buildIncomeExpenseOption(incomeExpenseData),
    [incomeExpenseData]
  )

  const netCashFlowOption = useMemo(
    () =>
      buildDivergingBarOption(
        savingsPoints.map((point) => ({ label: point.label, value: point.netSavings })),
        'Net savings'
      ),
    [savingsPoints]
  )

  const savingsRateOption = useMemo(
    () =>
      buildPercentLineOption(
        savingsPoints.map((point) => ({ label: point.label, value: point.savingsRate })),
        'Savings rate'
      ),
    [savingsPoints]
  )

  const hasData = transactions.length > 0

  return (
    <div className="reports-page__charts">
      <ReportChartCard
        title="Income vs Expense"
        subtitle="Clustered comparison per time bucket"
        option={incomeVsExpenseOption}
        hasData={hasData}
      />
      <ReportChartCard
        title="Net Savings"
        subtitle="Income minus spending per bucket, with investments counted as saved"
        option={netCashFlowOption}
        hasData={hasData}
      />
      <ReportChartCard
        title="Savings Rate Over Time"
        subtitle="Share of income not spent, per time bucket"
        option={savingsRateOption}
        hasData={hasData}
        fullWidth
      />
    </div>
  )
}
