import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'
import './Dialog.css'

interface DialogProps {
  isOpen: boolean
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
  panelClassName?: string
  bodyClassName?: string
}

export function Dialog({
  isOpen,
  title,
  onClose,
  children,
  className = '',
  panelClassName = '',
  bodyClassName = ''
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) {
      dialog.showModal()
    }
    if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <dialog
      ref={dialogRef}
      className={`ui-dialog ${className}`.trim()}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <div className={`ui-dialog__panel ${panelClassName}`.trim()}>
        <header className="ui-dialog__header">
          <h2>{title}</h2>
          <Button type="button" variant="icon" size="icon" onClick={onClose} aria-label="Close dialog">
            ×
          </Button>
        </header>
        <div className={`ui-dialog__body ${bodyClassName}`.trim()}>{children}</div>
      </div>
    </dialog>
  )
}
