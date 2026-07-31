import { useEffect, useState } from 'react'
import { AccountSubType, AccountType } from '../../../../src/types/account'
import type { Account, CreateAccountRequest, UpdateAccountRequest } from '../../../../src/types/account'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import './AccountDialog.css'

const PALETTE = [
  { hex: '#E74C3C', label: 'Red' },
  { hex: '#E67E22', label: 'Orange' },
  { hex: '#F1C40F', label: 'Yellow' },
  { hex: '#2ECC71', label: 'Green' },
  { hex: '#1ABC9C', label: 'Teal' },
  { hex: '#3498DB', label: 'Blue' },
  { hex: '#9B59B6', label: 'Purple' },
  { hex: '#EC407A', label: 'Pink' },
]

const ACCOUNT_TYPES: { label: string; subType: AccountSubType }[] = [
  { label: 'Checking',   subType: AccountSubType.Checking },
  { label: 'Savings',    subType: AccountSubType.Savings },
  { label: 'Credit',     subType: AccountSubType.Credit },
  { label: 'Investment', subType: AccountSubType.Investment },
]

function toDateInputValue(date: Date): string {
  const d = new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

interface AccountDialogProps {
  mode: 'create' | 'edit'
  account?: Account
  onClose: () => void
  onSaved: () => void
}

export function AccountDialog({ mode, account, onClose, onSaved }: AccountDialogProps) {
  const initialSubType = account?.sub_type ?? AccountSubType.Checking
  const [subType, setSubType] = useState<AccountSubType>(
    initialSubType === AccountSubType.Salary ? AccountSubType.Checking : initialSubType
  )
  const [institutionName, setInstitutionName] = useState(account?.institution_name ?? '')
  const [accountName, setAccountName] = useState(account?.account_name ?? '')
  const [broker, setBroker] = useState(
    account?.metadata?.brokerage ? String(account.metadata.brokerage) : ''
  )
  const [color, setColor] = useState(account?.color ?? PALETTE[5].hex)
  const [openedOn, setOpenedOn] = useState(
    account?.opened_on ? toDateInputValue(new Date(account.opened_on)) : ''
  )
  const [creditLimit, setCreditLimit] = useState('')
  const [statementDay, setStatementDay] = useState('')
  const [paymentDueDay, setPaymentDueDay] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isInvestment = subType === AccountSubType.Investment
  const isCredit = subType === AccountSubType.Credit

  useEffect(() => {
    let isMounted = true
    if (mode === 'edit' && account && account.sub_type === AccountSubType.Credit) {
      window.financeAPI
        .getCreditCard(account.account_id)
        .then((details) => {
          if (!isMounted || !details) return
          setCreditLimit(String(details.credit_limit))
          setStatementDay(String(details.statement_day))
          setPaymentDueDay(String(details.payment_due_day))
        })
        .catch((err) => console.error(err))
    }
    return () => {
      isMounted = false
    }
  }, [mode, account])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const nameForValidation = isInvestment ? broker : institutionName
    if (!nameForValidation.trim() || !accountName.trim() || !openedOn) {
      setError('All fields are required.')
      return
    }

    let creditValues: { limit: number; statementDay: number; dueDay: number } | null = null
    if (isCredit) {
      const limit = parseFloat(creditLimit)
      const stmtDay = parseInt(statementDay, 10)
      const dueDay = parseInt(paymentDueDay, 10)
      if (isNaN(limit) || limit <= 0) {
        setError('Credit limit must be a positive number.')
        return
      }
      if (isNaN(stmtDay) || stmtDay < 1 || stmtDay > 31) {
        setError('Statement day must be between 1 and 31.')
        return
      }
      if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
        setError('Payment due day must be between 1 and 31.')
        return
      }
      creditValues = { limit, statementDay: stmtDay, dueDay }
    }

    setSaving(true)
    try {
      const resolvedInstitution = isInvestment ? broker.trim() : institutionName.trim()
      const metadata = isInvestment ? { brokerage: broker.trim() } : undefined
      const accountType = isCredit ? AccountType.Liability : AccountType.Asset

      let accountId = account?.account_id
      if (mode === 'create') {
        const request: CreateAccountRequest = {
          institution_name: resolvedInstitution,
          account_name: accountName.trim(),
          account_type: accountType,
          sub_type: subType,
          color,
          opened_on: new Date(openedOn),
          metadata,
        }
        const created = await window.financeAPI.createAccount(request)
        accountId = created.account_id
      } else if (mode === 'edit' && account) {
        const request: UpdateAccountRequest = {
          institution_name: resolvedInstitution,
          account_name: accountName.trim(),
          account_type: accountType,
          sub_type: subType,
          color,
          opened_on: new Date(openedOn),
          metadata,
        }
        await window.financeAPI.updateAccount(account.account_id, request)
      }

      if (isCredit && creditValues && accountId) {
        await window.financeAPI.upsertCreditCard(accountId, {
          credit_limit: creditValues.limit,
          statement_day: creditValues.statementDay,
          payment_due_day: creditValues.dueDay,
        })
      }

      onSaved()
    } catch (err) {
      console.error(err)
      setError('Failed to save account. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      isOpen
      className="account-dialog"
      panelClassName="account-dialog__panel"
      bodyClassName="account-dialog__body"
      title={mode === 'create' ? 'Add Account' : 'Edit Account'}
      onClose={onClose}
    >
      <form className="account-dialog__form" onSubmit={handleSubmit}>
        {/* Type selector strip */}
        <div className="account-dialog__type-strip">
          {ACCOUNT_TYPES.map(({ label, subType: st }) => (
            <button
              key={st}
              type="button"
              className={`account-dialog__type-btn${subType === st ? ' account-dialog__type-btn--active' : ''}`}
              onClick={() => setSubType(st)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Fields based on selected type */}
        {isInvestment ? (
          <Input
            id="broker"
            label="Broker"
            type="text"
            value={broker}
            onChange={(e) => setBroker(e.target.value)}
            placeholder="e.g. Zerodha, Groww"
            required
          />
        ) : (
          <Input
            id="institutionName"
            label="Bank Name"
            type="text"
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
            placeholder="e.g. HDFC, SBI"
            required
          />
        )}

        <Input
          id="accountName"
          label={subType === AccountSubType.Credit ? 'Card Name' : 'Account Name'}
          type="text"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder={subType === AccountSubType.Credit ? 'e.g. HDFC Regalia' : 'e.g. Main Savings'}
          required
        />

        <div className="account-dialog__field">
          <label>Color</label>
          <div className="account-dialog__color-picker">
            {PALETTE.map(({ hex, label }) => (
              <label key={hex} className="account-dialog__color-option" title={label}>
                <input
                  type="radio"
                  name="color"
                  value={hex}
                  checked={color === hex}
                  onChange={() => setColor(hex)}
                />
                <span
                  className={`account-dialog__color-circle${color === hex ? ' account-dialog__color-circle--selected' : ''}`}
                  style={{ backgroundColor: hex }}
                />
              </label>
            ))}
          </div>
        </div>

        <Input
          id="openedOn"
          label="Opened On"
          type="date"
          value={openedOn}
          onChange={(e) => setOpenedOn(e.target.value)}
          required
        />

        {isCredit && (
          <>
            <Input
              id="creditLimit"
              label="Credit Limit"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 5000"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              required
            />
            <Input
              id="statementDay"
              label="Statement Day (1-31)"
              type="number"
              min="1"
              max="31"
              step="1"
              placeholder="e.g. 5"
              value={statementDay}
              onChange={(e) => setStatementDay(e.target.value)}
              required
            />
            <Input
              id="paymentDueDay"
              label="Payment Due Day (1-31)"
              type="number"
              min="1"
              max="31"
              step="1"
              placeholder="e.g. 23"
              value={paymentDueDay}
              onChange={(e) => setPaymentDueDay(e.target.value)}
              required
            />
          </>
        )}

        {error && <p className="account-dialog__error">{error}</p>}

        <div className="account-dialog__actions">
          <Button type="button" variant="secondary" className="account-dialog__btn-cancel" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="pill" className="account-dialog__btn-save" disabled={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Add Account' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
