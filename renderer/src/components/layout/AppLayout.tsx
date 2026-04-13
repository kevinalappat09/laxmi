import { type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { useSidebarToggle } from '../../hooks/useSidebarToggle'
import './AppLayout.css'

export type Page = 'home' | 'accounts' | 'account-detail'

interface AppLayoutProps {
  children: ReactNode
  activePage: Page
  onNavigate: (page: Page) => void
}

export function AppLayout({ children, activePage, onNavigate }: AppLayoutProps) {
  const [isSidebarOpen, toggleSidebar] = useSidebarToggle(true)

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        activePage={activePage}
        onNavigate={onNavigate}
      />
      <main className="app-layout__content">{children}</main>
    </div>
  )
}
