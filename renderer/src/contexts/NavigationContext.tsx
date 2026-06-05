import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Page } from '../types/navigation'

interface NavigationContextValue {
  activePage: Page
  selectedAccountId: number | null
  selectedAssetId: number | null
  navigate: (page: Page) => void
  selectAccount: (accountId: number) => void
  goBackToAccounts: () => void
  selectAsset: (assetId: number) => void
  goBackToPortfolio: () => void
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined)

interface NavigationProviderProps {
  children: ReactNode
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const [activePage, setActivePage] = useState<Page>('home')
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null)

  const value = useMemo<NavigationContextValue>(
    () => ({
      activePage,
      selectedAccountId,
      selectedAssetId,
      navigate: (page) => setActivePage(page),
      selectAccount: (accountId) => {
        setSelectedAccountId(accountId)
        setActivePage('account-detail')
      },
      goBackToAccounts: () => {
        setSelectedAccountId(null)
        setActivePage('accounts')
      },
      selectAsset: (assetId) => {
        setSelectedAssetId(assetId)
        setActivePage('portfolio-asset-detail')
      },
      goBackToPortfolio: () => {
        setSelectedAssetId(null)
        setActivePage('portfolio')
      },
    }),
    [activePage, selectedAccountId, selectedAssetId]
  )

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider')
  }
  return context
}
