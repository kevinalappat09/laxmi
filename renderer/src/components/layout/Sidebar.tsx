import { type Page } from './AppLayout'
import './Sidebar.css'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  activePage: Page
  onNavigate: (page: Page) => void
}

export function Sidebar({ isOpen, onToggle, activePage, onNavigate }: SidebarProps) {
  return (
    <>
      {!isOpen && (
        <button
          className="sidebar__open-btn"
          onClick={onToggle}
          title="Open sidebar (Ctrl+\)"
          aria-label="Open sidebar"
        >
          ›
        </button>
      )}

      <aside className={`sidebar${isOpen ? '' : ' sidebar--collapsed'}`}>
        <div className="sidebar__header">
          <button
            className="sidebar__toggle-btn"
            onClick={onToggle}
            title="Close sidebar (Ctrl+\)"
            aria-label="Close sidebar"
          >
            ‹
          </button>
        </div>

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
        </nav>
      </aside>
    </>
  )
}
