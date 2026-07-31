import { useState } from 'react'
import type { Account } from '../../../../src/types/account'
import type { Category } from '../../../../src/types/category'
import type { Transaction, CreateTransactionRequest, UpdateTransactionRequest } from '../../../../src/types/transaction'
import { TransactionType, Classification } from '../../../../src/types/transaction'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Input, Select } from '../../components/ui/Input'
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
  const defaultAccountId = transaction?.account_id ?? accounts[0]?.account_id ?? 0
  const [accountId, setAccountId] = useState(String(defaultAccountId))
  const [payee, setPayee] = useState(transaction?.payee ?? '')
  const [transactionDate, setTransactionDate] = useState(
    transaction?.transaction_date ? toDateInputValue(transaction.transaction_date) : toDateInputValue(new Date())
  )
  const [transactionType, setTransactionType] = useState<TransactionType>(
    transaction?.transaction_type ?? TransactionType.Withdraw
  )
  const [transferAccountId, setTransferAccountId] = useState(
    transaction?.transfer_account_id ? String(transaction.transfer_account_id) : ''
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

    const isTransfer = transactionType === TransactionType.Transfer
    if (isTransfer) {
      if (!transferAccountId) {
        setError('Select a destination account for the transfer.')
        return
      }
      if (transferAccountId === accountId) {
        setError('Transfer destination must differ from the source account.')
        return
      }
    }

    const transferAccount = isTransfer ? Number(transferAccountId) : undefined

    setSaving(true)
    try {
      if (mode === 'create') {
        const request: CreateTransactionRequest = {
          account_id: Number(accountId),
          payee: payee.trim() || undefined,
          transaction_date: new Date(transactionDate),
          transaction_type: transactionType,
          amount: parsedAmount,
          category_id: isTransfer ? undefined : categoryId ? Number(categoryId) : undefined,
          classification,
          note: note.trim() || undefined,
          transfer_account_id: transferAccount,
        }
        await window.financeAPI.createTransaction(request)
      } else if (mode === 'edit' && transaction?.transaction_id) {
        const request: UpdateTransactionRequest = {
          payee: payee.trim() || undefined,
          transaction_date: new Date(transactionDate),
          transaction_type: transactionType,
          amount: parsedAmount,
          category_id: isTransfer ? undefined : categoryId ? Number(categoryId) : undefined,
          classification,
          note: note.trim() || undefined,
          transfer_account_id: transferAccount,
        }
        await window.financeAPI.updateTransaction(transaction.transaction_id, request)
      }
      onSaved()
    } catch (err) {
      console.error(err)
      setError('Failed to save transaction. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      isOpen
      className="transaction-dialog"
      panelClassName="transaction-dialog__panel"
      bodyClassName="transaction-dialog__body"
      title={mode === 'create' ? 'Add Transaction' : 'Edit Transaction'}
      onClose={onClose}
    >
      <form className="transaction-dialog__form" onSubmit={handleSubmit}>
        <div className="transaction-dialog__grid">
          <Select
            id="tx-account"
            label="Account"
            className="transaction-dialog__field"
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
          </Select>

          <Input
            id="tx-payee"
            label="Payee"
            className="transaction-dialog__field"
            type="text"
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
            placeholder="e.g. Amazon, Salary"
          />

          <Input
            id="tx-date"
            label="Date"
            className="transaction-dialog__field"
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            required
          />

          <Select
            id="tx-type"
            label="Type"
            className="transaction-dialog__field"
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value as TransactionType)}
          >
            <option value={TransactionType.Withdraw}>Withdraw</option>
            <option value={TransactionType.Deposit}>Deposit</option>
            <option value={TransactionType.Transfer}>Transfer</option>
          </Select>

          {transactionType === TransactionType.Transfer && (
            <Select
              id="tx-transfer-account"
              label="To Account"
              className="transaction-dialog__field"
              value={transferAccountId}
              onChange={(e) => setTransferAccountId(e.target.value)}
              required
            >
              <option value="" disabled>Select destination…</option>
              {accounts
                .filter((a) => String(a.account_id) !== accountId)
                .map((a) => (
                  <option key={a.account_id} value={a.account_id}>
                    {a.account_name}
                  </option>
                ))}
            </Select>
          )}

          <Input
            id="tx-amount"
            label="Amount"
            className="transaction-dialog__field"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />

          {transactionType !== TransactionType.Transfer && (
            <>
              <Select
                id="tx-category"
                label="Category"
                className="transaction-dialog__field"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.category_id} value={c.category_id}>
                    {c.category_name}
                  </option>
                ))}
              </Select>

              <Select
                id="tx-classification"
                label="Classification"
                className="transaction-dialog__field"
                value={classification}
                onChange={(e) => setClassification(e.target.value as Classification)}
              >
                <option value={Classification.Needs}>Needs</option>
                <option value={Classification.Wants}>Wants</option>
                <option value={Classification.Unnecessary}>Unnecessary</option>
                <option value={Classification.Wasteful}>Wasteful</option>
              </Select>
            </>
          )}

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
          <Button type="button" variant="secondary" className="transaction-dialog__btn-cancel" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="pill" className="transaction-dialog__btn-save" disabled={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Add Transaction' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
