import { useState } from 'react'
import { AccountSubType, AccountType } from '../../../../src/types/account'
import type { Account, CreateAccountRequest, UpdateAccountRequest } from '../../../../src/types/account'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Input, Select } from '../../components/ui/Input'
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
  const [institutionName, setInstitutionName] = useState(account?.institution_name ?? '')
  const [accountName, setAccountName] = useState(account?.account_name ?? '')
  const [subType, setSubType] = useState<AccountSubType>(account?.sub_type ?? AccountSubType.Checking)
  const [color, setColor] = useState(account?.color ?? PALETTE[5].hex)
  const [openedOn, setOpenedOn] = useState(
    account?.opened_on ? toDateInputValue(new Date(account.opened_on)) : ''
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!institutionName.trim() || !accountName.trim() || !openedOn) {
      setError('All fields are required.')
      return
    }

    setSaving(true)
    try {
      if (mode === 'create') {
        const request: CreateAccountRequest = {
          institution_name: institutionName.trim(),
          account_name: accountName.trim(),
          account_type: AccountType.Asset,
          sub_type: subType,
          color,
          opened_on: new Date(openedOn),
        }
        await window.financeAPI.createAccount(request)
      } else if (mode === 'edit' && account) {
        const request: UpdateAccountRequest = {
          institution_name: institutionName.trim(),
          account_name: accountName.trim(),
          account_type: AccountType.Asset,
          sub_type: subType,
          color,
          opened_on: new Date(openedOn),
        }
        await window.financeAPI.updateAccount(account.account_id, request)
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
        <Input
          id="institutionName"
          label="Institution Name"
          type="text"
          value={institutionName}
          onChange={(e) => setInstitutionName(e.target.value)}
          placeholder="e.g. Chase, Wells Fargo"
          required
        />

        <Input
          id="accountName"
          label="Account Name"
          type="text"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="e.g. Main Checking"
          required
        />

        <Select
          id="subType"
          label="Type"
          value={subType}
          onChange={(e) => setSubType(e.target.value as AccountSubType)}
        >
          <option value={AccountSubType.Checking}>Checking</option>
        </Select>

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
