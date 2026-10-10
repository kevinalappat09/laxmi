import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import * as LabelPrimitive from '@radix-ui/react-label'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import './controls.css'

export interface RadioOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

interface RadioGroupProps extends Omit<ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>, 'children'> {
  label: string
  options: RadioOption[]
}

export function RadioGroup({ label, options, className = '', ...props }: RadioGroupProps) {
  return (
    <fieldset className={`ui-radio-group ${className}`.trim()}>
      <legend className="ui-field__label">{label}</legend>
      <RadioGroupPrimitive.Root {...props}>
        {options.map((option) => {
          const id = `${props.name ?? 'radio'}-${option.value}`
          return (
            <LabelPrimitive.Root key={option.value} className="ui-control-label" htmlFor={id}>
              <RadioGroupPrimitive.Item
                id={id}
                className="ui-radio-group__item"
                value={option.value}
                disabled={option.disabled}
              >
                <RadioGroupPrimitive.Indicator className="ui-radio-group__indicator" />
              </RadioGroupPrimitive.Item>
              <span>{option.label}</span>
            </LabelPrimitive.Root>
          )
        })}
      </RadioGroupPrimitive.Root>
    </fieldset>
  )
}
