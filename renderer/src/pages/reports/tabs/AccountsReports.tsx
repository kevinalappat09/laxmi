import { useMemo } from 'react'
import type { Account } from '../../../../../src/types/account'
import { TransactionType, type Transaction } from '../../../../../src/types/transaction'
import { aggregateByKey, collapseToTopN } from '../../../utils/chartUtils'
import { assignSeriesColors, buildPieOption, mergeSeriesKeys } from '../../../utils/reportOptions'
import { ReportChartCard } from '../components/ReportChartCard'

interface AccountsReportsProps {
  transactions: Transaction[]
  accounts: Account[]
}

export function AccountsReports({ transactions, accounts }: AccountsReportsProps) {
  const accountNameById = useMemo(
    () => new Map(accounts.map((account) => [account.account_id, account.account_name])),
    [accounts]
  )

  const resolveAccountName = useMemo(
    () => (transaction: Transaction) =>
      accountNameById.get(transaction.account_id) ?? `Account ${transaction.account_id}`,
    [accountNameById]
  )

  const expenseData = useMemo(
    () => collapseToTopN(aggregateByKey(transactions, resolveAccountName, TransactionType.Withdraw)),
    [transactions, resolveAccountName]
  )

  const incomeData = useMemo(
    () => collapseToTopN(aggregateByKey(transactions, resolveAccountName, TransactionType.Deposit)),
    [transactions, resolveAccountName]
  )

  const colorMap = useMemo(
    () =>
      assignSeriesColors(
        mergeSeriesKeys(
          expenseData.map((point) => point.name),
          incomeData.map((point) => point.name)
        )
      ),
    [expenseData, incomeData]
  )

  const expenseOption = useMemo(() => buildPieOption(expenseData, colorMap), [expenseData, colorMap])
  const incomeOption = useMemo(() => buildPieOption(incomeData, colorMap), [incomeData, colorMap])

  return (
    <div className="reports-page__charts">
      <ReportChartCard
        title="Accounts Expense Breakdown"
        subtitle="Expense distribution by account"
        option={expenseOption}
        hasData={expenseData.length > 0}
      />
      <ReportChartCard
        title="Accounts Income Breakdown"
        subtitle="Income distribution by account"
        option={incomeOption}
        hasData={incomeData.length > 0}
      />
    </div>
  )
}
