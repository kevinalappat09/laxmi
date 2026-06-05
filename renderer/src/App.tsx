import { useEffect, useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { HomePage } from './pages/home/HomePage'
import { AccountsPage } from './pages/accounts/AccountsPage'
import { AccountDetailPage } from './pages/accounts/AccountDetailPage'
import { TransactionsPage } from './pages/transactions/TransactionsPage'
import { RecurringPage } from './pages/recurring/RecurringPage'
import { BudgetsPage } from './pages/budgets/BudgetsPage'
import { ImportExportPage } from './pages/importexport/ImportExportPage'
import { ReportsPage } from './pages/reports/ReportsPage'
import { PortfolioPage } from './pages/portfolio/PortfolioPage'
import { AssetDetailPage } from './pages/portfolio/AssetDetailPage'
import { CommandPalette, type PaletteAction } from './components/CommandPalette'
import { NavigationProvider, useNavigation } from './contexts/NavigationContext'
import { ProfileSelectionPage } from './pages/profile/ProfileSelectionPage'
import './App.css'

type PendingAction = 'addAccount' | 'addTransaction' | null

function AppContent() {
  const { activePage, selectedAccountId, selectedAssetId, navigate, selectAccount } = useNavigation()
  const [currentProfile, setCurrentProfile] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSelectionDialog, setShowSelectionDialog] = useState(false)
  const [profiles, setProfiles] = useState<string[]>([])
  const [newProfileName, setNewProfileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)

  const handlePaletteAction = (action: PaletteAction) => {
    switch (action.type) {
      case 'navigate':
        navigate(action.page)
        break
      case 'selectAccount':
        selectAccount(action.accountId)
        break
      case 'addAccount':
        setPendingAction('addAccount')
        navigate('accounts')
        break
      case 'addTransaction':
        setPendingAction('addTransaction')
        navigate('transactions')
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

  const handleCreateProfile = async () => {
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
  }

  const renderContent = () => {
    if (activePage === 'home') {
      return <HomePage currentProfile={currentProfile!} onSwitchProfile={handleSwitchProfile} />
    }

    if (activePage === 'accounts') {
      return (
        <AccountsPage
          autoOpenDialog={pendingAction === 'addAccount'}
          onAutoOpenHandled={() => setPendingAction(null)}
        />
      )
    }

    if (activePage === 'account-detail' && selectedAccountId !== null) {
      return <AccountDetailPage accountId={selectedAccountId} />
    }

    if (activePage === 'transactions') {
      return (
        <TransactionsPage
          autoOpenDialog={pendingAction === 'addTransaction'}
          onAutoOpenHandled={() => setPendingAction(null)}
        />
      )
    }

    if (activePage === 'budgets') {
      return <BudgetsPage />
    }

    if (activePage === 'recurring') {
      return <RecurringPage />
    }

    if (activePage === 'reports') {
      return <ReportsPage />
    }

    if (activePage === 'portfolio') {
      return <PortfolioPage />
    }

    if (activePage === 'portfolio-asset-detail' && selectedAssetId !== null) {
      return <AssetDetailPage assetId={selectedAssetId} />
    }

    return <ImportExportPage />
  }

  return (
    <div className="app-root">
      {isLoading && <div>Loading...</div>}
      {!isLoading && currentProfile && <AppLayout>{renderContent()}</AppLayout>}

      {currentProfile && (
        <CommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          onAction={handlePaletteAction}
        />
      )}

      {!isLoading && !currentProfile && showSelectionDialog && (
        <ProfileSelectionPage
          profiles={profiles}
          newProfileName={newProfileName}
          error={error}
          onProfileNameChange={setNewProfileName}
          onOpenProfile={handleOpenProfile}
          onCreateProfile={handleCreateProfile}
        />
      )}
    </div>
  )
}

function App() {
  return (
    <NavigationProvider>
      <AppContent />
    </NavigationProvider>
  )
}

export default App
