import { useEffect, useState } from 'react'
import type { Account } from '../../../../src/types/account'
import type { Transaction } from '../../../../src/types/transaction'
import { TransactionType } from '../../../../src/types/transaction'
import './AccountDetailPage.css'

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatSubType(subType: string): string {
  return subType.charAt(0).toUpperCase() + subType.slice(1)
}

function computeBalance(transactions: Transaction[]): number {
  return transactions.reduce((sum, tx) => {
    if (tx.transaction_type === TransactionType.Deposit) return sum + tx.amount
    if (tx.transaction_type === TransactionType.Withdraw) return sum - tx.amount
    return sum
  }, 0)
}

interface AccountDetailPageProps {
  accountId: number
  onBack: () => void
}

export function AccountDetailPage({ accountId, onBack }: AccountDetailPageProps) {
  const [account, setAccount] = useState<Account | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const [acct, txns] = await Promise.all([
          window.financeAPI.getAccount(accountId),
          window.financeAPI.getTransactionsByAccount(accountId),
        ])
        if (!isMounted) return
        setAccount(acct)
        const sorted = [...txns].sort(
          (a, b) =>
            new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
        )
        setTransactions(sorted)
      } catch (err) {
        console.error(err)
        if (!isMounted) return
        setError('Failed to load account details.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [accountId])

  if (isLoading) {
    return (
      <div className="account-detail">
        <button className="account-detail__back-btn" onClick={onBack}>
          ← Back
        </button>
        <div className="account-detail__loading">Loading…</div>
      </div>
    )
  }

  if (error || !account) {
    return (
      <div className="account-detail">
        <button className="account-detail__back-btn" onClick={onBack}>
          ← Back
        </button>
        <div className="account-detail__error">{error ?? 'Account not found.'}</div>
      </div>
    )
  }

  const balance = computeBalance(transactions)
  const balanceClass =
    balance >= 0
      ? 'account-detail__balance account-detail__balance--positive'
      : 'account-detail__balance account-detail__balance--negative'

  return (
    <div className="account-detail">
      <button className="account-detail__back-btn" onClick={onBack}>
        ← Back
      </button>

      <div className="account-detail__summary">
        <div
          className="account-detail__color-swatch"
          style={{ backgroundColor: account.color }}
        />
        <div className="account-detail__summary-info">
          <h1 className="account-detail__account-name">{account.account_name}</h1>
          <p className="account-detail__institution">{account.institution_name}</p>
        </div>
        <div className="account-detail__summary-right">
          <span className={balanceClass}>{formatCurrency(balance)}</span>
          <span className="account-detail__subtype-badge">
            {formatSubType(account.sub_type)}
          </span>
        </div>
      </div>

      <h2 className="account-detail__section-title">Transactions</h2>

      {transactions.length === 0 ? (
        <p className="account-detail__empty">No transactions yet for this account.</p>
      ) : (
        <div className="account-detail__table-wrapper">
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Payee</th>
                <th>Type</th>
                <th>Classification</th>
                <th className="transactions-table__amount-col">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const isDeposit = tx.transaction_type === TransactionType.Deposit
                const isWithdraw = tx.transaction_type === TransactionType.Withdraw
                const amountClass = isDeposit
                  ? 'transactions-table__amount transactions-table__amount--deposit'
                  : isWithdraw
                    ? 'transactions-table__amount transactions-table__amount--withdraw'
                    : 'transactions-table__amount transactions-table__amount--transfer'
                const amountPrefix = isDeposit ? '+' : isWithdraw ? '-' : ''

                return (
                  <tr key={tx.transaction_id} className="transactions-table__row">
                    <td>{formatDate(tx.transaction_date)}</td>
                    <td>
                      {tx.payee ? (
                        tx.payee
                      ) : (
                        <span className="transactions-table__payee--empty">—</span>
                      )}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{tx.transaction_type}</td>
                    <td style={{ textTransform: 'capitalize' }}>{tx.classification}</td>
                    <td className={amountClass}>
                      {amountPrefix}
                      {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
