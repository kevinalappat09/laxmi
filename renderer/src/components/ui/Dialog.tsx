import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { Button } from './Button'
import './Dialog.css'

interface DialogProps {
  open: boolean
  title: string
  onOpenChange: (open: boolean) => void
  children: ReactNode
  className?: string
  panelClassName?: string
  bodyClassName?: string
  showHeader?: boolean
}

export function Dialog({ open, title, onOpenChange, children, className = '', panelClassName = '', bodyClassName = '', showHeader = true }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-dialog__overlay" />
        <DialogPrimitive.Content className={`ui-dialog__panel ${className} ${panelClassName}`.trim()}>
          {showHeader ? (
            <header className="ui-dialog__header">
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <Button type="button" variant="icon" size="icon" aria-label="Close dialog">×</Button>
              </DialogPrimitive.Close>
            </header>
          ) : <DialogPrimitive.Title className="ui-visually-hidden">{title}</DialogPrimitive.Title>}
          <div className={`ui-dialog__body ${bodyClassName}`.trim()}>{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
