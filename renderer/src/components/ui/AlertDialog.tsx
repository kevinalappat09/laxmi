import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import type { ReactNode } from 'react'
import { Button } from './Button'
import './Dialog.css'

interface AlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  cancelLabel?: string
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  cancelLabel = 'Cancel',
}: AlertDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="ui-dialog__overlay" />
        <AlertDialogPrimitive.Content className="ui-dialog__panel ui-alert-dialog">
          <AlertDialogPrimitive.Title className="ui-dialog__title">{title}</AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="ui-dialog__description">
            {description}
          </AlertDialogPrimitive.Description>
          <div className="ui-dialog__actions">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="secondary">{cancelLabel}</Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
