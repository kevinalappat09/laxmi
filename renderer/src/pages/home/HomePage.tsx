import { useEffect, useState } from 'react'
import { AccountSubType, type Account } from '../../../../src/types/account'
import type { Transaction } from '../../../../src/types/transaction'
import { TransactionType } from '../../../../src/types/transaction'
import { useNavigation } from '../../contexts/NavigationContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { NotificationsPanel } from '../../components/home/NotificationsPanel'
import { useNotifications } from '../../hooks/useNotifications'
import { formatCurrency } from '../../utils/formatters'
import './HomePage.css'

function computeBalance(transactions: Transaction[]): number {
  return transactions.reduce((sum, tx) => {
    if (tx.transaction_type === TransactionType.Deposit) return sum + tx.amount
    if (tx.transaction_type === TransactionType.Withdraw) return sum - tx.amount
    return sum
  }, 0)
}

interface AccountWithBalance {
  account: Account
  balance: number
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
        const accounts = await window.financeAPI.listActiveAccounts()
        if (!isMounted) return

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

        const initial: AccountWithBalance[] = accounts.map((account) => ({
          account,
          balance: 0,
          isLoadingBalance: true,
        }))
        setAccountsWithBalance(initial)
        setIsLoading(false)

        await Promise.all(
          accounts.map(async (account) => {
            try {
              const balance =
                account.sub_type === AccountSubType.Investment
                  ? await window.financeAPI.portfolio.analytics.valueByAccount(account.account_id)
                  : computeBalance(
                      await window.financeAPI.getTransactionsByAccount(account.account_id)
                    )
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
      <div className="home-page__header">
        <div className="home-page__welcome">
          <h1 className="home-page__title">Welcome back, {currentProfile}!</h1>
        </div>
        <Button variant="ghost" className="home-page__switch-btn" onClick={onSwitchProfile}>
          Switch Profile
        </Button>
      </div>

      <NotificationsPanel
        notifications={notifications}
        isLoading={isLoadingNotifications}
        error={notificationsError}
      />

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

      {error && <p className="home-page__error">{error}</p>}

      {isLoading ? (
        <div className="home-page__loading">Loading accounts…</div>
      ) : accountsWithBalance.length === 0 ? (
        <div className="home-page__empty">
          No accounts yet. Go to Accounts to add one.
        </div>
      ) : (
        <div className="home-page__cards">
          {accountsWithBalance.map(({ account, balance, isLoadingBalance }) => (
            <Card
              key={account.account_id}
              className="account-card"
              padding="none"
              asButton
              onClick={() => selectAccount(account.account_id)}
            >
              <div
                className="account-card__color-bar"
                style={{ backgroundColor: account.color }}
              />
              <div className="account-card__body">
                <p className="account-card__institution">{account.institution_name}</p>
                <h2 className="account-card__name">{account.account_name}</h2>
                <p
                  className={`account-card__balance${balance < 0 ? ' account-card__balance--negative' : ''}`}
                >
                  {isLoadingBalance ? '…' : formatCurrency(balance)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
