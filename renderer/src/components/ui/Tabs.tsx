import * as TabsPrimitive from '@radix-ui/react-tabs'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import './controls.css'

export interface TabItem {
  value: string
  label: ReactNode
  content: ReactNode
  disabled?: boolean
}

interface TabsProps extends Omit<ComponentPropsWithoutRef<typeof TabsPrimitive.Root>, 'children'> {
  items: TabItem[]
  ariaLabel: string
}

export function Tabs({ items, ariaLabel, className = '', ...props }: TabsProps) {
  return (
    <TabsPrimitive.Root className={`ui-tabs ${className}`.trim()} {...props}>
      <TabsPrimitive.List className="ui-tabs__list" aria-label={ariaLabel}>
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            className="ui-tabs__trigger"
            value={item.value}
            disabled={item.disabled}
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content key={item.value} className="ui-tabs__content" value={item.value}>
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  )
}
