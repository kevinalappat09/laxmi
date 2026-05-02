import { useState, useEffect } from 'react'
import './TitleBar.css'

interface TitleBarProps {
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

export function TitleBar({ isSidebarOpen, onToggleSidebar }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.windowAPI.isMaximized().then(setIsMaximized)
  }, [])

  const handleMinimize = () => window.windowAPI.minimize()

  const handleMaximize = () => {
    window.windowAPI.maximize()
    setIsMaximized((prev) => !prev)
  }

  const handleClose = () => window.windowAPI.close()

  return (
    <div className="title-bar">
      <div className="title-bar__left">
        <button
          className="title-bar__btn title-bar__sidebar-btn"
          onClick={onToggleSidebar}
          title={isSidebarOpen ? 'Close sidebar (Ctrl+\\)' : 'Open sidebar (Ctrl+\\)'}
          aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <rect y="2" width="15" height="1.5" rx="0.75" fill="currentColor" />
            <rect y="6.75" width="15" height="1.5" rx="0.75" fill="currentColor" />
            <rect y="11.5" width="15" height="1.5" rx="0.75" fill="currentColor" />
          </svg>
        </button>
      </div>

      <div className="title-bar__drag" />

      <div className="title-bar__controls">
        <button
          className="title-bar__btn title-bar__control-btn"
          onClick={handleMinimize}
          title="Minimize"
          aria-label="Minimize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <rect y="4.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>

        <button
          className="title-bar__btn title-bar__control-btn"
          onClick={handleMaximize}
          title={isMaximized ? 'Restore' : 'Maximize'}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <rect x="2.5" y="0.5" width="7" height="7" rx="0.4" stroke="currentColor" strokeWidth="1" />
              <rect x="0.5" y="2.5" width="7" height="7" rx="0.4" stroke="currentColor" strokeWidth="1" fill="var(--color-bg-app)" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <rect x="0.5" y="0.5" width="9" height="9" rx="0.4" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          )}
        </button>

        <button
          className="title-bar__btn title-bar__control-btn title-bar__close-btn"
          onClick={handleClose}
          title="Close"
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
