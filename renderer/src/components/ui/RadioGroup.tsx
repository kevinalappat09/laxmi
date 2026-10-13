import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import * as LabelPrimitive from '@radix-ui/react-label'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import './controls.css'
import './utilities.css'

export interface RadioOption {
  value: string
  label: ReactNode
  description?: ReactNode
  visual?: ReactNode
  disabled?: boolean
}

interface RadioGroupProps extends Omit<ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>, 'children'> {
  label: string
  options: RadioOption[]
  variant?: 'inline' | 'cards' | 'swatches'
  hideLabel?: boolean
}

export function RadioGroup({ label, options, variant = 'inline', hideLabel = false, className = '', ...props }: RadioGroupProps) {
  return (
    <fieldset className={`ui-radio-group ui-radio-group--${variant} ${className}`.trim()}>
      <legend className={`ui-field__label${hideLabel ? ' ui-visually-hidden' : ''}`}>{label}</legend>
      <RadioGroupPrimitive.Root className="ui-radio-group__root" {...props}>
        {options.map((option) => {
          const id = `${props.name ?? 'radio'}-${option.value}`
          return (
            <LabelPrimitive.Root
              key={option.value}
              className={`ui-control-label ui-radio-group__option${option.disabled ? ' ui-radio-group__option--disabled' : ''}`}
              htmlFor={id}
              title={typeof option.label === 'string' ? option.label : undefined}
            >
              <RadioGroupPrimitive.Item
                id={id}
                className="ui-radio-group__item"
                value={option.value}
                disabled={option.disabled}
              >
                <RadioGroupPrimitive.Indicator className="ui-radio-group__indicator" />
              </RadioGroupPrimitive.Item>
              {option.visual}
              <span className="ui-radio-group__copy">
                <strong>{option.label}</strong>
                {option.description && <small>{option.description}</small>}
              </span>
            </LabelPrimitive.Root>
          )
        })}
      </RadioGroupPrimitive.Root>
    </fieldset>
  )
}
