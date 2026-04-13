import { useEffect, useState } from 'react'
import type { Account } from '../../../../src/types/account'
import { AccountDialog } from './AccountDialog'
import './AccountsPage.css'

function formatSubType(subType: string): string {
  return subType.charAt(0).toUpperCase() + subType.slice(1)
}

interface AccountsPageProps {
  onSelectAccount: (accountId: number) => void
  autoOpenDialog?: boolean
  onAutoOpenHandled?: () => void
}

export function AccountsPage({ onSelectAccount, autoOpenDialog, onAutoOpenHandled }: AccountsPageProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<Account | undefined>(undefined)

  const loadAccounts = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.financeAPI.listActiveAccounts()
      setAccounts(result)
    } catch (err) {
      console.error(err)
      setError('Failed to load accounts.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    if (autoOpenDialog) {
      setSelectedAccount(undefined)
      setDialogMode('create')
      onAutoOpenHandled?.()
    }
  }, [autoOpenDialog])

  const handleAddClick = () => {
    setSelectedAccount(undefined)
    setDialogMode('create')
  }

  const handleEditClick = (account: Account) => {
    setSelectedAccount(account)
    setDialogMode('edit')
  }

  const handleDeleteClick = async (account: Account) => {
    if (!window.confirm(`Delete "${account.account_name}"? This cannot be undone.`)) return
    try {
      await window.financeAPI.deactivateAccount(account.account_id)
      await loadAccounts()
    } catch (err) {
      console.error(err)
      setError('Failed to delete account.')
    }
  }

  const handleDialogClose = () => {
    setDialogMode(null)
    setSelectedAccount(undefined)
  }

  const handleDialogSaved = () => {
    handleDialogClose()
    loadAccounts()
  }

  return (
    <div className="accounts-page">
      <div className="accounts-page__header">
        <h1>Accounts</h1>
        <button className="accounts-page__add-btn" onClick={handleAddClick}>
          + Add Account
        </button>
      </div>

      {error && <p className="accounts-page__error">{error}</p>}

      {isLoading ? (
        <div className="accounts-page__loading">Loading accounts…</div>
      ) : accounts.length === 0 ? (
        <div className="accounts-page__empty">
          No accounts yet. Add one to get started.
        </div>
      ) : (
        <div className="accounts-page__table-wrapper">
          <table className="accounts-table">
            <thead>
              <tr>
                <th>Institution</th>
                <th>Account</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr
                  key={account.account_id}
                  className="accounts-table__row accounts-table__row--clickable"
                  style={{ borderLeft: `4px solid ${account.color}` }}
                  onClick={() => onSelectAccount(account.account_id)}
                >
                  <td>{account.institution_name}</td>
                  <td>{account.account_name}</td>
                  <td>{formatSubType(account.sub_type)}</td>
                  <td className="accounts-table__actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="accounts-table__btn-edit"
                      onClick={() => handleEditClick(account)}
                    >
                      Edit
                    </button>
                    <button
                      className="accounts-table__btn-delete"
                      onClick={() => handleDeleteClick(account)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialogMode && (
        <AccountDialog
          mode={dialogMode}
          account={selectedAccount}
          onClose={handleDialogClose}
          onSaved={handleDialogSaved}
        />
      )}
    </div>
  )
}
