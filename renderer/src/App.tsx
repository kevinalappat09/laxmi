import { useEffect, useState } from 'react'
import { AppLayout, type Page } from './components/layout/AppLayout'
import { HomePage } from './pages/home/HomePage'
import { AccountsPage } from './pages/accounts/AccountsPage'
import { AccountDetailPage } from './pages/accounts/AccountDetailPage'
import { TransactionsPage } from './pages/transactions/TransactionsPage'
import { CommandPalette, type PaletteAction } from './components/CommandPalette'
import './App.css'

type PendingAction = 'addAccount' | 'addTransaction' | null

function App() {
  const [currentProfile, setCurrentProfile] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSelectionDialog, setShowSelectionDialog] = useState(false)
  const [profiles, setProfiles] = useState<string[]>([])
  const [newProfileName, setNewProfileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [activePage, setActivePage] = useState<Page>('home')
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)

  const handleSelectAccount = (accountId: number) => {
    setSelectedAccountId(accountId)
    setActivePage('account-detail')
  }

  const handleBackToAccounts = () => {
    setSelectedAccountId(null)
    setActivePage('accounts')
  }

  const handlePaletteAction = (action: PaletteAction) => {
    switch (action.type) {
      case 'navigate':
        setActivePage(action.page)
        break
      case 'selectAccount':
        handleSelectAccount(action.accountId)
        break
      case 'addAccount':
        setPendingAction('addAccount')
        setActivePage('accounts')
        break
      case 'addTransaction':
        setPendingAction('addTransaction')
        setActivePage('transactions')
        break
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault()
        if (currentProfile) setIsPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentProfile])

  const handleOpenProfile = async (name: string) => {
    setIsLoading(true)
    setError(null)

    try {
      await window.financeAPI.openProfile(name)
      setCurrentProfile(name)
      setShowSelectionDialog(false)
    } catch (e) {
      console.error(e)
      setError('Failed to open profile.')
      setShowSelectionDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwitchProfile = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const existingProfiles = await window.financeAPI.listProfiles()
      setProfiles(existingProfiles)
      setCurrentProfile(null)
      setShowSelectionDialog(true)
    } catch (e) {
      console.error(e)
      setError('Failed to load profiles.')
      setShowSelectionDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    window.financeAPI
      .getLastOpenedProfile()
      .then(async (profileName) => {
        if (!isMounted) return

        if (profileName) {
          await window.financeAPI.openProfile(profileName)
          if (!isMounted) return
          setCurrentProfile(profileName)
          setShowSelectionDialog(false)
          setIsLoading(false)
        } else {
          const existingProfiles = await window.financeAPI.listProfiles()
          if (!isMounted) return
          setProfiles(existingProfiles)
          setShowSelectionDialog(true)
          setIsLoading(false)
        }
      })
      .catch(() => {
        if (!isMounted) return
        setShowSelectionDialog(true)
        setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="app-root">
      {isLoading && <div>Loading...</div>}

      {!isLoading && currentProfile && activePage === 'home' && (
        <AppLayout activePage="home" onNavigate={setActivePage}>
          <HomePage
            currentProfile={currentProfile}
            onSwitchProfile={handleSwitchProfile}
            onSelectAccount={handleSelectAccount}
            onNavigate={setActivePage}
          />
        </AppLayout>
      )}

      {!isLoading && currentProfile && activePage === 'accounts' && (
        <AppLayout activePage="accounts" onNavigate={setActivePage}>
          <AccountsPage
            onSelectAccount={handleSelectAccount}
            autoOpenDialog={pendingAction === 'addAccount'}
            onAutoOpenHandled={() => setPendingAction(null)}
          />
        </AppLayout>
      )}

      {!isLoading && currentProfile && activePage === 'account-detail' && selectedAccountId !== null && (
        <AppLayout activePage="accounts" onNavigate={setActivePage}>
          <AccountDetailPage accountId={selectedAccountId} onBack={handleBackToAccounts} />
        </AppLayout>
      )}

      {!isLoading && currentProfile && activePage === 'transactions' && (
        <AppLayout activePage="transactions" onNavigate={setActivePage}>
          <TransactionsPage
            autoOpenDialog={pendingAction === 'addTransaction'}
            onAutoOpenHandled={() => setPendingAction(null)}
          />
        </AppLayout>
      )}

      {currentProfile && (
        <CommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          onAction={handlePaletteAction}
        />
      )}

      {!isLoading && !currentProfile && showSelectionDialog && (
        <div className="profile-selection">
          <h1>Profile Selection</h1>

          <div className="profile-list">
            <h2>Existing Profiles</h2>
            {error && (
              <div style={{ color: 'red', marginBottom: '0.5rem' }}>
                {error}
              </div>
            )}
            {profiles.length === 0 ? (
              <div>No profiles found.</div>
            ) : (
              <ul>
                {profiles.map((name) => (
                  <li
                    key={name}
                    onClick={() => handleOpenProfile(name)}
                    style={{ cursor: 'pointer', padding: '0.5rem 0' }}
                  >
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="profile-create">
            <h2>Create New Profile</h2>
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Profile name"
            />
            <button
              onClick={async () => {
                const trimmed = newProfileName.trim()
                if (!trimmed) return
                setError(null)
                try {
                  await window.financeAPI.createProfile(trimmed)
                  await handleOpenProfile(trimmed)
                } catch (e) {
                  console.error(e)
                  setError('Failed to create profile.')
                }
              }}
            >
              Create Profile
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
