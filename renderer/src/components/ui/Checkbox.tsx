import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as LabelPrimitive from '@radix-ui/react-label'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import './controls.css'

interface CheckboxProps extends ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  id: string
  label: ReactNode
}

export function Checkbox({ id, label, className = '', ...props }: CheckboxProps) {
  return (
    <LabelPrimitive.Root className="ui-control-label" htmlFor={id}>
      <CheckboxPrimitive.Root id={id} className={`ui-checkbox ${className}`.trim()} {...props}>
        <CheckboxPrimitive.Indicator className="ui-checkbox__indicator">✓</CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <span>{label}</span>
    </LabelPrimitive.Root>
  )
}
