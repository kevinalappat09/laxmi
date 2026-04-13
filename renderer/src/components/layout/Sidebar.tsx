import './Sidebar.css'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
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
          {/* Navigation items will go here */}
        </nav>
      </aside>
    </>
  )
}
