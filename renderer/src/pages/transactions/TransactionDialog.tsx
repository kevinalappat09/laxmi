import { useEffect, useRef, useState } from 'react'
import type { Account } from '../../../../src/types/account'
import type { Category } from '../../../../src/types/category'
import type { Transaction, CreateTransactionRequest, UpdateTransactionRequest } from '../../../../src/types/transaction'
import { TransactionType, Classification } from '../../../../src/types/transaction'
import './TransactionDialog.css'

function toDateInputValue(date: Date | string): string {
  const d = new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

interface TransactionDialogProps {
  mode: 'create' | 'edit'
  transaction?: Transaction
  accounts: Account[]
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

export function TransactionDialog({
  mode,
  transaction,
  accounts,
  categories,
  onClose,
  onSaved,
}: TransactionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const defaultAccountId = transaction?.account_id ?? accounts[0]?.account_id ?? 0
  const [accountId, setAccountId] = useState(String(defaultAccountId))
  const [payee, setPayee] = useState(transaction?.payee ?? '')
  const [transactionDate, setTransactionDate] = useState(
    transaction?.transaction_date ? toDateInputValue(transaction.transaction_date) : toDateInputValue(new Date())
  )
  const [transactionType, setTransactionType] = useState<TransactionType>(
    transaction?.transaction_type ?? TransactionType.Withdraw
  )
  const [amount, setAmount] = useState(transaction?.amount ? String(transaction.amount) : '')
  const [categoryId, setCategoryId] = useState(
    transaction?.category_id ? String(transaction.category_id) : ''
  )
  const [classification, setClassification] = useState<Classification>(
    transaction?.classification ?? Classification.Needs
  )
  const [note, setNote] = useState(transaction?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!accountId || !transactionDate || !amount) {
      setError('Account, date, and amount are required.')
      return
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be a positive number.')
      return
    }

    setSaving(true)
    try {
      if (mode === 'create') {
        const request: CreateTransactionRequest = {
          account_id: Number(accountId),
          payee: payee.trim() || undefined,
          transaction_date: new Date(transactionDate),
          transaction_type: transactionType,
          amount: parsedAmount,
          category_id: categoryId ? Number(categoryId) : undefined,
          classification,
          note: note.trim() || undefined,
        }
        await window.financeAPI.createTransaction(request)
      } else if (mode === 'edit' && transaction?.transaction_id) {
        const request: UpdateTransactionRequest = {
          payee: payee.trim() || undefined,
          transaction_date: new Date(transactionDate),
          transaction_type: transactionType,
          amount: parsedAmount,
          category_id: categoryId ? Number(categoryId) : undefined,
          classification,
          note: note.trim() || undefined,
        }
        await window.financeAPI.updateTransaction(transaction.transaction_id, request)
      }
      onSaved()
      dialogRef.current?.close()
    } catch (err) {
      console.error(err)
      setError('Failed to save transaction. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="transaction-dialog" onClick={handleBackdropClick}>
      <div className="transaction-dialog__panel">
        <div className="transaction-dialog__header">
          <h2>{mode === 'create' ? 'Add Transaction' : 'Edit Transaction'}</h2>
          <button
            type="button"
            className="transaction-dialog__close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <form className="transaction-dialog__form" onSubmit={handleSubmit}>
          <div className="transaction-dialog__grid">
            <div className="transaction-dialog__field">
              <label htmlFor="tx-account">Account</label>
              <select
                id="tx-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
                disabled={mode === 'edit'}
              >
                <option value="" disabled>Select account…</option>
                {accounts.map((a) => (
                  <option key={a.account_id} value={a.account_id}>
                    {a.account_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="transaction-dialog__field">
              <label htmlFor="tx-payee">Payee</label>
              <input
                id="tx-payee"
                type="text"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                placeholder="e.g. Amazon, Salary"
              />
            </div>

            <div className="transaction-dialog__field">
              <label htmlFor="tx-date">Date</label>
              <input
                id="tx-date"
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                required
              />
            </div>

            <div className="transaction-dialog__field">
              <label htmlFor="tx-type">Type</label>
              <select
                id="tx-type"
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value as TransactionType)}
              >
                <option value={TransactionType.Withdraw}>Withdraw</option>
                <option value={TransactionType.Deposit}>Deposit</option>
                <option value={TransactionType.Transfer}>Transfer</option>
              </select>
            </div>

            <div className="transaction-dialog__field">
              <label htmlFor="tx-amount">Amount</label>
              <input
                id="tx-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="transaction-dialog__field">
              <label htmlFor="tx-category">Category</label>
              <select
                id="tx-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.category_id} value={c.category_id}>
                    {c.category_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="transaction-dialog__field">
              <label htmlFor="tx-classification">Classification</label>
              <select
                id="tx-classification"
                value={classification}
                onChange={(e) => setClassification(e.target.value as Classification)}
              >
                <option value={Classification.Needs}>Needs</option>
                <option value={Classification.Wants}>Wants</option>
                <option value={Classification.Unnecessary}>Unnecessary</option>
                <option value={Classification.Wasteful}>Wasteful</option>
              </select>
            </div>

            <div className="transaction-dialog__field transaction-dialog__field--full">
              <label htmlFor="tx-note">Note <span className="transaction-dialog__optional">(optional)</span></label>
              <textarea
                id="tx-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note…"
                rows={2}
              />
            </div>
          </div>

          {error && <p className="transaction-dialog__error">{error}</p>}

          <div className="transaction-dialog__actions">
            <button type="button" className="transaction-dialog__btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="transaction-dialog__btn-save" disabled={saving}>
              {saving ? 'Saving…' : mode === 'create' ? 'Add Transaction' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
