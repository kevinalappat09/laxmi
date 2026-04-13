import { type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { useSidebarToggle } from '../../hooks/useSidebarToggle'
import './AppLayout.css'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isSidebarOpen, toggleSidebar] = useSidebarToggle(true)

  return (
    <div className="app-layout">
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
      <main className="app-layout__content">{children}</main>
    </div>
  )
}
