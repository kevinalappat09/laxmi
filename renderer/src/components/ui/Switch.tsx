import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as LabelPrimitive from '@radix-ui/react-label'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import './controls.css'

interface SwitchProps extends ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  id: string
  label: ReactNode
}

export function Switch({ id, label, className = '', ...props }: SwitchProps) {
  return (
    <LabelPrimitive.Root className="ui-control-label" htmlFor={id}>
      <SwitchPrimitive.Root id={id} className={`ui-switch ${className}`.trim()} {...props}>
        <SwitchPrimitive.Thumb className="ui-switch__thumb" />
      </SwitchPrimitive.Root>
      <span>{label}</span>
    </LabelPrimitive.Root>
  )
}
