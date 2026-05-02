import { useMemo } from 'react'
import type { Account } from '../../../../../src/types/account'
import { TransactionType, type Transaction } from '../../../../../src/types/transaction'
import { aggregateByKey } from '../../../utils/chartUtils'
import { buildPieOption } from '../../../utils/reportOptions'
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

  const expenseData = useMemo(
    () =>
      aggregateByKey(
        transactions,
        (tx) => accountNameById.get(tx.account_id) ?? `Account ${tx.account_id}`,
        TransactionType.Withdraw
      ),
    [transactions, accountNameById]
  )

  const incomeData = useMemo(
    () =>
      aggregateByKey(
        transactions,
        (tx) => accountNameById.get(tx.account_id) ?? `Account ${tx.account_id}`,
        TransactionType.Deposit
      ),
    [transactions, accountNameById]
  )

  const expenseOption = useMemo(() => buildPieOption(expenseData), [expenseData])
  const incomeOption = useMemo(() => buildPieOption(incomeData), [incomeData])

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
