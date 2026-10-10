import * as PopoverPrimitive from '@radix-ui/react-popover'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import './controls.css'

interface PopoverProps extends ComponentPropsWithoutRef<typeof PopoverPrimitive.Root> {
  trigger: ReactNode
  children: ReactNode
  contentClassName?: string
}

export function Popover({ trigger, children, contentClassName = '', ...props }: PopoverProps) {
  return (
    <PopoverPrimitive.Root {...props}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className={`ui-popover__content ${contentClassName}`.trim()}
          sideOffset={6}
          collisionPadding={12}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
