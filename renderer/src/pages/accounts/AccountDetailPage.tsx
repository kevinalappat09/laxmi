import { useEffect, useState } from 'react'
import type { Account } from '../../../../src/types/account'
import { AccountSubType } from '../../../../src/types/account'
import type { Transaction } from '../../../../src/types/transaction'
import { TransactionType } from '../../../../src/types/transaction'
import type { CreditCardSummary } from '../../../../src/types/creditCard'
import { computeAccountBalance } from '../../../../src/utils/balanceUtils'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Tag } from '../../components/ui/Tag'
import { useNavigation } from '../../contexts/NavigationContext'
import { formatCurrency, formatDate } from '../../utils/formatters'
import './AccountDetailPage.css'

function formatSubType(subType: string): string {
  return subType.charAt(0).toUpperCase() + subType.slice(1)
}

interface AccountDetailPageProps {
  accountId: number
}

export function AccountDetailPage({ accountId }: AccountDetailPageProps) {
  const { goBackToAccounts } = useNavigation()
  const [account, setAccount] = useState<Account | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [creditSummary, setCreditSummary] = useState<CreditCardSummary | null>(null)
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
          window.financeAPI.getTransactionsAffectingAccount(accountId),
        ])
        if (!isMounted) return
        setAccount(acct)
        const sorted = [...txns].sort(
          (a, b) =>
            new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
        )
        setTransactions(sorted)

        if (acct.sub_type === AccountSubType.Credit) {
          const summaries = await window.financeAPI.listCreditCardSummaries()
          if (!isMounted) return
          setCreditSummary(
            summaries.find((s) => s.account.account_id === accountId) ?? null
          )
        } else {
          setCreditSummary(null)
        }
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
        <Button variant="square" className="account-detail__back-btn" onClick={goBackToAccounts}>
          ← Back
        </Button>
        <div className="account-detail__loading">Loading…</div>
      </div>
    )
  }

  if (error || !account) {
    return (
      <div className="account-detail">
        <Button variant="square" className="account-detail__back-btn" onClick={goBackToAccounts}>
          ← Back
        </Button>
        <div className="account-detail__error">{error ?? 'Account not found.'}</div>
      </div>
    )
  }

  const balance = computeAccountBalance(transactions, accountId)
  const balanceClass =
    balance >= 0
      ? 'account-detail__balance account-detail__balance--positive'
      : 'account-detail__balance account-detail__balance--negative'

  return (
    <div className="account-detail">
      <Button variant="square" className="account-detail__back-btn" onClick={goBackToAccounts}>
        ← Back
      </Button>

      <Card className="account-detail__summary">
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
          <Tag className="account-detail__subtype-badge">
            {formatSubType(account.sub_type)}
          </Tag>
        </div>
      </Card>

      {creditSummary && (
        <Card className="account-detail__credit">
          <div className="account-detail__credit-grid">
            <div className="account-detail__credit-stat">
              <span className="account-detail__credit-label">Credit Limit</span>
              <span className="account-detail__credit-value">
                {formatCurrency(creditSummary.details.credit_limit)}
              </span>
            </div>
            <div className="account-detail__credit-stat">
              <span className="account-detail__credit-label">Outstanding</span>
              <span className="account-detail__credit-value">
                {formatCurrency(creditSummary.outstanding)}
              </span>
            </div>
            <div className="account-detail__credit-stat">
              <span className="account-detail__credit-label">Available</span>
              <span className="account-detail__credit-value">
                {formatCurrency(creditSummary.available)}
              </span>
            </div>
            <div className="account-detail__credit-stat">
              <span className="account-detail__credit-label">Utilization</span>
              <span className="account-detail__credit-value">
                {(creditSummary.utilization * 100).toFixed(1)}%
              </span>
            </div>
            <div className="account-detail__credit-stat">
              <span className="account-detail__credit-label">Next Statement</span>
              <span className="account-detail__credit-value">
                {formatDate(creditSummary.next_statement_date)}
              </span>
            </div>
            <div className="account-detail__credit-stat">
              <span className="account-detail__credit-label">Payment Due</span>
              <span className="account-detail__credit-value">
                {formatDate(creditSummary.next_due_date)}
              </span>
            </div>
          </div>
        </Card>
      )}

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
                const isTransfer = tx.transaction_type === TransactionType.Transfer
                const isIncomingTransfer = isTransfer && tx.transfer_account_id === accountId
                const isInflow = isDeposit || isIncomingTransfer

                const amountClass = isDeposit
                  ? 'transactions-table__amount transactions-table__amount--deposit'
                  : isWithdraw
                    ? 'transactions-table__amount transactions-table__amount--withdraw'
                    : 'transactions-table__amount transactions-table__amount--transfer'
                const amountPrefix = isInflow ? '+' : '-'
                const typeLabel = isTransfer
                  ? isIncomingTransfer
                    ? 'transfer in'
                    : 'transfer out'
                  : tx.transaction_type

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
                    <td style={{ textTransform: 'capitalize' }}>{typeLabel}</td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {isTransfer ? '—' : tx.classification}
                    </td>
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
