import type { Page } from '../../types/navigation'
import './Sidebar.css'

interface SidebarProps {
  isOpen: boolean
  activePage: Page
  onNavigate: (page: Page) => void
}

export function Sidebar({ isOpen, activePage, onNavigate }: SidebarProps) {
  return (
    <aside className={`sidebar${isOpen ? '' : ' sidebar--collapsed'}`}>
      <nav className="sidebar__nav" aria-label="Main navigation">
        <button
          className={`sidebar__nav-item${activePage === 'home' ? ' sidebar__nav-item--active' : ''}`}
          onClick={() => onNavigate('home')}
        >
          Home
        </button>
        <button
          className={`sidebar__nav-item${activePage === 'accounts' || activePage === 'account-detail' ? ' sidebar__nav-item--active' : ''}`}
          onClick={() => onNavigate('accounts')}
        >
          Accounts
        </button>
        <button
          className={`sidebar__nav-item${activePage === 'transactions' ? ' sidebar__nav-item--active' : ''}`}
          onClick={() => onNavigate('transactions')}
        >
          Transactions
        </button>
        <button
          className={`sidebar__nav-item${activePage === 'recurring' ? ' sidebar__nav-item--active' : ''}`}
          onClick={() => onNavigate('recurring')}
        >
          Recurring
        </button>
        <button
          className={`sidebar__nav-item${activePage === 'budgets' ? ' sidebar__nav-item--active' : ''}`}
          onClick={() => onNavigate('budgets')}
        >
          Budgets
        </button>
        <button
          className={`sidebar__nav-item${activePage === 'reports' ? ' sidebar__nav-item--active' : ''}`}
          onClick={() => onNavigate('reports')}
        >
          Reports
        </button>
        <button
          className={`sidebar__nav-item${activePage === 'import-export' ? ' sidebar__nav-item--active' : ''}`}
          onClick={() => onNavigate('import-export')}
        >
          Import / Export
        </button>
      </nav>
    </aside>
  )
}
