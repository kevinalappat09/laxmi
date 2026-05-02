import { type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TitleBar } from './TitleBar'
import { useSidebarToggle } from '../../hooks/useSidebarToggle'
import { useNavigation } from '../../contexts/NavigationContext'
import './AppLayout.css'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isSidebarOpen, toggleSidebar] = useSidebarToggle(true)
  const { activePage, navigate } = useNavigation()

  return (
    <div className="app-layout">
      <TitleBar isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />
      <div className="app-layout__body">
        <Sidebar isOpen={isSidebarOpen} activePage={activePage} onNavigate={navigate} />
        <main className="app-layout__content">{children}</main>
      </div>
    </div>
  )
}
