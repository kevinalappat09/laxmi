import { useEffect, useState } from 'react'
import type { Account } from '../../../../src/types/account'
import { AccountDialog } from './AccountDialog'
import { AlertDialog, Button, EmptyState, PageHeader, TableContainer } from '../../components/ui'
import { useNavigation } from '../../contexts/NavigationContext'
import './AccountsPage.css'

function formatSubType(subType: string): string {
  return subType.charAt(0).toUpperCase() + subType.slice(1)
}

interface AccountsPageProps {
  autoOpenDialog?: boolean
  onAutoOpenHandled?: () => void
}

export function AccountsPage({ autoOpenDialog, onAutoOpenHandled }: AccountsPageProps) {
  const { selectAccount } = useNavigation()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<Account | undefined>(undefined)
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null)

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

  const handleDeleteConfirm = async () => {
    if (!accountToDelete) return
    try {
      await window.financeAPI.deactivateAccount(accountToDelete.account_id)
      setAccountToDelete(null)
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
      <PageHeader title="Accounts" actions={<Button variant="pill" className="accounts-page__add-btn" onClick={handleAddClick}>
          + Add Account
        </Button>} />

      {error && <p className="accounts-page__error">{error}</p>}

      {isLoading ? (
        <div className="accounts-page__loading">Loading accounts…</div>
      ) : accounts.length === 0 ? (
        <EmptyState title="No accounts yet" description="Add one to get started." action={<Button variant="pill" onClick={handleAddClick}>+ Add Account</Button>} />
      ) : (
        <TableContainer className="accounts-page__table-wrapper">
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
                <tr key={account.account_id} className="accounts-table__row" style={{ borderLeft: `4px solid ${account.color}` }}>
                  <td>{account.institution_name}</td>
                  <td>
                    <Button variant="subtle" className="accounts-table__account-link" onClick={() => selectAccount(account.account_id)}>
                      {account.account_name}
                    </Button>
                  </td>
                  <td>{formatSubType(account.sub_type)}</td>
                  <td className="accounts-table__actions" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="accounts-table__btn-edit"
                      onClick={() => handleEditClick(account)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      className="accounts-table__btn-delete"
                      onClick={() => setAccountToDelete(account)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      )}

      {dialogMode && (
        <AccountDialog
          mode={dialogMode}
          account={selectedAccount}
          onClose={handleDialogClose}
          onSaved={handleDialogSaved}
        />
      )}
      <AlertDialog
        open={accountToDelete !== null}
        onOpenChange={(open) => !open && setAccountToDelete(null)}
        title="Delete account?"
        description={`Delete “${accountToDelete?.account_name ?? ''}”? This cannot be undone.`}
        confirmLabel="Delete account"
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  )
}
