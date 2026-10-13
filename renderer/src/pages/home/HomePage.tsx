import { useEffect, useState } from 'react'
import { AccountSubType, type Account } from '../../../../src/types/account'
import type { CreditCardSummary } from '../../../../src/types/creditCard'
import { TransactionType } from '../../../../src/types/transaction'
import { computeAccountBalance } from '../../../../src/utils/balanceUtils'
import { useNavigation } from '../../contexts/NavigationContext'
import { Button, Card, EmptyState, PageHeader } from '../../components/ui'
import { NotificationsPanel } from '../../components/home/NotificationsPanel'
import { useNotifications } from '../../hooks/useNotifications'
import { formatCurrency } from '../../utils/formatters'
import './HomePage.css'

interface AccountWithBalance {
  account: Account
  balance: number
  creditLimit?: number
  isLoadingBalance: boolean
}

interface HomePageProps {
  currentProfile: string
  onSwitchProfile: () => void
}

interface HomeMetrics {
  monthIncome: number
  monthExpense: number
  yearIncome: number
  yearExpense: number
}

const EMPTY_HOME_METRICS: HomeMetrics = {
  monthIncome: 0,
  monthExpense: 0,
  yearIncome: 0,
  yearExpense: 0,
}

function getDateStarts(now: Date): { monthStart: Date; yearStart: Date } {
  return {
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    yearStart: new Date(now.getFullYear(), 0, 1),
  }
}

export function HomePage({ currentProfile, onSwitchProfile }: HomePageProps) {
  const { selectAccount } = useNavigation()
  const {
    notifications,
    isLoading: isLoadingNotifications,
    error: notificationsError,
  } = useNotifications(10)
  const [accountsWithBalance, setAccountsWithBalance] = useState<AccountWithBalance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true)
  const [metrics, setMetrics] = useState<HomeMetrics>(EMPTY_HOME_METRICS)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function load() {
      setIsLoading(true)
      setError(null)
      setIsLoadingMetrics(true)
      try {
        const [accounts, creditSummaries] = await Promise.all([
          window.financeAPI.listActiveAccounts(),
          window.financeAPI.listCreditCardSummaries().catch((summaryError) => {
            console.error(summaryError)
            return []
          }),
        ])
        if (!isMounted) return

        const creditSummaryByAccountId = new Map<number, CreditCardSummary>(
          creditSummaries.map((summary) => [summary.account.account_id, summary])
        )

        if (accounts.length === 0) {
          setMetrics(EMPTY_HOME_METRICS)
          setIsLoadingMetrics(false)
        }

        const now = new Date()
        const { monthStart, yearStart } = getDateStarts(now)
        const metricResults = await Promise.all(
          accounts.map(async (account) => {
            const [monthTxns, yearTxns] = await Promise.all([
              window.financeAPI.findTransactionsWithFilter({
                accountId: account.account_id,
                fromDate: monthStart,
                toDate: now,
              }),
              window.financeAPI.findTransactionsWithFilter({
                accountId: account.account_id,
                fromDate: yearStart,
                toDate: now,
              }),
            ])
            return { monthTxns, yearTxns }
          })
        )
        if (!isMounted) return

        const monthTransactions = metricResults.flatMap((result) => result.monthTxns)
        const yearTransactions = metricResults.flatMap((result) => result.yearTxns)
        const monthIncome = monthTransactions
          .filter((tx) => tx.transaction_type === TransactionType.Deposit)
          .reduce((sum, tx) => sum + tx.amount, 0)
        const monthExpense = monthTransactions
          .filter((tx) => tx.transaction_type === TransactionType.Withdraw)
          .reduce((sum, tx) => sum + tx.amount, 0)
        const yearIncome = yearTransactions
          .filter((tx) => tx.transaction_type === TransactionType.Deposit)
          .reduce((sum, tx) => sum + tx.amount, 0)
        const yearExpense = yearTransactions
          .filter((tx) => tx.transaction_type === TransactionType.Withdraw)
          .reduce((sum, tx) => sum + tx.amount, 0)

        setMetrics({
          monthIncome: Number(monthIncome.toFixed(2)),
          monthExpense: Number(monthExpense.toFixed(2)),
          yearIncome: Number(yearIncome.toFixed(2)),
          yearExpense: Number(yearExpense.toFixed(2)),
        })
        setIsLoadingMetrics(false)

        const initial: AccountWithBalance[] = accounts.map((account) => {
          const creditSummary = creditSummaryByAccountId.get(account.account_id)
          return {
            account,
            balance: creditSummary?.outstanding ?? 0,
            creditLimit: creditSummary?.details.credit_limit,
            isLoadingBalance: creditSummary === undefined,
          }
        })
        setAccountsWithBalance(initial)
        setIsLoading(false)

        await Promise.all(
          accounts.map(async (account) => {
            if (creditSummaryByAccountId.has(account.account_id)) return

            try {
              const calculatedBalance =
                account.sub_type === AccountSubType.Investment
                  ? await window.financeAPI.portfolio.analytics.valueByAccount(account.account_id)
                  : computeAccountBalance(
                      await window.financeAPI.getTransactionsAffectingAccount(account.account_id),
                      account.account_id
                    )
              const balance = account.sub_type === AccountSubType.Credit
                ? Math.max(0, -calculatedBalance)
                : calculatedBalance
              if (!isMounted) return
              setAccountsWithBalance((prev) =>
                prev.map((item) =>
                  item.account.account_id === account.account_id
                    ? { ...item, balance, isLoadingBalance: false }
                    : item
                )
              )
            } catch {
              if (!isMounted) return
              setAccountsWithBalance((prev) =>
                prev.map((item) =>
                  item.account.account_id === account.account_id
                    ? { ...item, isLoadingBalance: false }
                    : item
                )
              )
            }
          })
        )
      } catch (err) {
        console.error(err)
        if (!isMounted) return
        setError('Failed to load accounts.')
        setIsLoading(false)
        setIsLoadingMetrics(false)
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="home-page">
      <PageHeader title={`Welcome back, ${currentProfile}!`} actions={<Button variant="ghost" className="home-page__switch-btn" onClick={onSwitchProfile}>
          Switch Profile
        </Button>} />

      {error && <p className="home-page__error">{error}</p>}

      {isLoading ? (
        <div className="home-page__loading">Loading accounts…</div>
      ) : accountsWithBalance.length === 0 ? (
        <EmptyState title="No accounts yet" description="Go to Accounts to add one." />
      ) : (
        <div className="home-page__cards">
          {accountsWithBalance.map(({ account, balance, creditLimit, isLoadingBalance }) => {
            const isCredit = account.sub_type === AccountSubType.Credit
            return (
              <Card
                key={account.account_id}
                className="account-card"
                padding="none"
              >
                <div
                  className="account-card__color-bar"
                  style={{ backgroundColor: account.color }}
                />
                <div className="account-card__body">
                  <p className="account-card__institution">{account.institution_name}</p>
                  <h2 className="account-card__name">
                    <Button
                      variant="subtle"
                      className="account-card__link"
                      onClick={() => selectAccount(account.account_id)}
                      aria-label={`Open ${account.account_name} account`}
                    >
                      {account.account_name}
                    </Button>
                  </h2>
                  {isCredit && <p className="account-card__balance-label">Utilized</p>}
                  <p
                    className={`account-card__balance${isCredit ? balance > 0 ? ' account-card__balance--negative' : ' account-card__balance--neutral' : balance < 0 ? ' account-card__balance--negative' : ''}`}
                  >
                    {isLoadingBalance ? '…' : formatCurrency(balance)}
                  </p>
                  {isCredit && creditLimit !== undefined && (
                    <p className="account-card__credit-limit">
                      Limit {formatCurrency(creditLimit)}
                    </p>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <div className="home-page__metrics">
        <Card className="metric-tile">
          <p className="metric-tile__label">This Month</p>
          <p className="metric-tile__sub-label">Income</p>
          <p className="metric-tile__value metric-tile__value--income">
            {isLoadingMetrics ? '…' : formatCurrency(metrics.monthIncome)}
          </p>
        </Card>
        <Card className="metric-tile">
          <p className="metric-tile__label">This Month</p>
          <p className="metric-tile__sub-label">Expenses</p>
          <p className="metric-tile__value metric-tile__value--expense">
            {isLoadingMetrics ? '…' : formatCurrency(metrics.monthExpense)}
          </p>
        </Card>
        <Card className="metric-tile">
          <p className="metric-tile__label">This Year</p>
          <p className="metric-tile__sub-label">Income</p>
          <p className="metric-tile__value metric-tile__value--income">
            {isLoadingMetrics ? '…' : formatCurrency(metrics.yearIncome)}
          </p>
        </Card>
        <Card className="metric-tile">
          <p className="metric-tile__label">This Year</p>
          <p className="metric-tile__sub-label">Expenses</p>
          <p className="metric-tile__value metric-tile__value--expense">
            {isLoadingMetrics ? '…' : formatCurrency(metrics.yearExpense)}
          </p>
        </Card>
      </div>

      <NotificationsPanel
        notifications={notifications}
        isLoading={isLoadingNotifications}
        error={notificationsError}
      />
    </div>
  )
}
