import { useEffect, useRef, useState } from 'react'
import type { Account } from '../../../src/types/account'
import type { Page } from '../types/navigation'
import './CommandPalette.css'

export type PaletteAction =
  | { type: 'navigate'; page: Page }
  | { type: 'selectAccount'; accountId: number }
  | { type: 'addAccount' }
  | { type: 'addTransaction' }

interface CommandItem {
  id: string
  label: string
  hint?: string
  action: PaletteAction
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onAction: (action: PaletteAction) => void
}

function buildStaticCommands(): CommandItem[] {
  return [
    {
      id: 'goto-home',
      label: 'Go to Home',
      hint: 'Navigation',
      action: { type: 'navigate', page: 'home' },
    },
    {
      id: 'goto-accounts',
      label: 'Go to Accounts',
      hint: 'Navigation',
      action: { type: 'navigate', page: 'accounts' },
    },
    {
      id: 'goto-transactions',
      label: 'Go to Transactions',
      hint: 'Navigation',
      action: { type: 'navigate', page: 'transactions' },
    },
    {
      id: 'add-account',
      label: 'Add Account',
      hint: 'Action',
      action: { type: 'addAccount' },
    },
    {
      id: 'add-transaction',
      label: 'Add Transaction',
      hint: 'Action',
      action: { type: 'addTransaction' },
    },
  ]
}

function buildAccountCommands(accounts: Account[]): CommandItem[] {
  return accounts.map((account) => ({
    id: `account-${account.account_id}`,
    label: account.account_name,
    hint: account.institution_name,
    action: { type: 'selectAccount', accountId: account.account_id },
  }))
}

export function CommandPalette({ isOpen, onClose, onAction }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActiveIndex(0)
      window.financeAPI.listActiveAccounts().then(setAccounts).catch(() => setAccounts([]))
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  const allCommands: CommandItem[] = [
    ...buildStaticCommands(),
    ...buildAccountCommands(accounts),
  ]

  const filtered = query.trim()
    ? allCommands.filter((cmd) =>
        `${cmd.label} ${cmd.hint ?? ''}`.toLowerCase().includes(query.toLowerCase())
      )
    : allCommands

  const safeIndex = Math.min(activeIndex, Math.max(filtered.length - 1, 0))

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[safeIndex]
      if (cmd) {
        onAction(cmd.action)
        onClose()
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    const el = listRef.current?.children[safeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [safeIndex])

  if (!isOpen) return null

  return (
    <div className="cmd-overlay" onMouseDown={onClose}>
      <div className="cmd-panel" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmd-input"
          type="text"
          placeholder="Type a command or search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Command palette search"
          autoComplete="off"
          spellCheck={false}
        />
        {filtered.length === 0 ? (
          <div className="cmd-empty">No results for "{query}"</div>
        ) : (
          <ul className="cmd-list" ref={listRef} role="listbox">
            {filtered.map((cmd, i) => (
              <li
                key={cmd.id}
                role="option"
                aria-selected={i === safeIndex}
                className={`cmd-item${i === safeIndex ? ' cmd-item--active' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onAction(cmd.action)
                  onClose()
                }}
              >
                <span className="cmd-item__label">{cmd.label}</span>
                {cmd.hint && <span className="cmd-item__hint">{cmd.hint}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
