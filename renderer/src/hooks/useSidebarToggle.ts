import { useCallback, useEffect, useState } from 'react'

export function useSidebarToggle(defaultOpen = true): [boolean, () => void] {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '\\') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggle])

  return [isOpen, toggle]
}
