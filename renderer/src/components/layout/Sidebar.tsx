import type { Page } from '../../types/navigation'
import laxmiIcon from '../../assets/laxmi-icon.png'
import { Button } from '../ui'
import './Sidebar.css'

interface SidebarProps {
  isOpen: boolean
  activePage: Page
  onNavigate: (page: Page) => void
}

export function Sidebar({ isOpen, activePage, onNavigate }: SidebarProps) {
  const items: Array<{ page: Page; label: string; active: boolean }> = [
    { page: 'home', label: 'Home', active: activePage === 'home' },
    { page: 'accounts', label: 'Accounts', active: activePage === 'accounts' || activePage === 'account-detail' },
    { page: 'transactions', label: 'Transactions', active: activePage === 'transactions' },
    { page: 'recurring', label: 'Recurring', active: activePage === 'recurring' },
    { page: 'budgets', label: 'Budgets', active: activePage === 'budgets' },
    { page: 'reports', label: 'Reports', active: activePage === 'reports' },
    { page: 'portfolio', label: 'Portfolio', active: activePage === 'portfolio' },
    { page: 'import-export', label: 'Import / Export', active: activePage === 'import-export' },
    { page: 'settings', label: 'Settings', active: activePage === 'settings' },
  ]

  return (
    <aside className={`sidebar${isOpen ? '' : ' sidebar--collapsed'}`}>
      <div className="sidebar__brand">
        <img src={laxmiIcon} alt="" className="sidebar__brand-icon" />
        <span>Laxmi</span>
      </div>
      <nav className="sidebar__nav" aria-label="Main navigation">
        {items.map((item) => (
          <Button
            key={item.page}
            variant="subtle"
            className={`sidebar__nav-item${item.active ? ' sidebar__nav-item--active' : ''}`}
            aria-current={item.active ? 'page' : undefined}
            onClick={() => onNavigate(item.page)}
          >
            {item.label}
          </Button>
        ))}
      </nav>
    </aside>
  )
}
