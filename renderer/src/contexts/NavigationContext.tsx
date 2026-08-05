import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Page } from '../types/navigation'
import type { ReportSectionId } from '../pages/reports/sections/types'

interface NavigationContextValue {
  activePage: Page
  selectedAccountId: number | null
  selectedAssetId: number | null
  /** Which section the Reports page opens on. There is no router, so this stands in for a URL. */
  reportSection: ReportSectionId
  navigate: (page: Page) => void
  setReportSection: (section: ReportSectionId) => void
  openReportSection: (section: ReportSectionId) => void
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
  const [reportSection, setReportSection] = useState<ReportSectionId>('home')

  const value = useMemo<NavigationContextValue>(
    () => ({
      activePage,
      selectedAccountId,
      selectedAssetId,
      reportSection,
      navigate: (page) => setActivePage(page),
      setReportSection,
      openReportSection: (section) => {
        setReportSection(section)
        setActivePage('reports')
      },
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
    [activePage, selectedAccountId, selectedAssetId, reportSection]
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
