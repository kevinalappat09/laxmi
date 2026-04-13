import { useEffect, useState } from 'react'
import type { Account } from '../../../../src/types/account'
import type { Transaction } from '../../../../src/types/transaction'
import { TransactionType } from '../../../../src/types/transaction'
import type { Page } from '../../components/layout/AppLayout'
import './HomePage.css'

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
}

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
  onSelectAccount: (accountId: number) => void
  onNavigate: (page: Page) => void
}

export function HomePage({ currentProfile, onSwitchProfile, onSelectAccount }: HomePageProps) {
  const [accountsWithBalance, setAccountsWithBalance] = useState<AccountWithBalance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const accounts = await window.financeAPI.listActiveAccounts()
        if (!isMounted) return

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
              const txns = await window.financeAPI.getTransactionsByAccount(account.account_id)
              if (!isMounted) return
              const balance = computeBalance(txns)
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
        <button className="home-page__switch-btn" onClick={onSwitchProfile}>
          Switch Profile
        </button>
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
            <button
              key={account.account_id}
              className="account-card"
              onClick={() => onSelectAccount(account.account_id)}
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
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
