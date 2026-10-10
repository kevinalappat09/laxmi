import * as LabelPrimitive from '@radix-ui/react-label'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Children, isValidElement, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import './Input.css'

interface BaseFieldProps {
  label: string
  id: string
  className?: string
  controlClassName?: string
  hideLabel?: boolean
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>, BaseFieldProps {}

interface OptionProps {
  value?: string | number
  disabled?: boolean
  children?: ReactNode
}

interface SelectProps extends BaseFieldProps {
  children: ReactNode
  value?: string | number
  defaultValue?: string | number
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void
  onValueChange?: (value: string) => void
  disabled?: boolean
  required?: boolean
  name?: string
}

const EMPTY_VALUE = '__laxmi_empty_value__'

export function Input({ label, id, className = '', controlClassName = '', hideLabel = false, ...props }: InputProps) {
  return (
    <div className={`ui-field ${className}`.trim()}>
      <LabelPrimitive.Root className={`ui-field__label${hideLabel ? ' ui-visually-hidden' : ''}`} htmlFor={id}>{label}</LabelPrimitive.Root>
      <input id={id} className={`ui-field__control ${controlClassName}`.trim()} {...props} />
    </div>
  )
}

export function Select({ label, id, className = '', children, value, defaultValue, onChange, onValueChange, ...props }: SelectProps) {
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<OptionProps>(child)) return []
    return [{
      value: String(child.props.value ?? ''),
      label: child.props.children,
      disabled: child.props.disabled,
    }]
  })
  const normalize = (nextValue: string | number | undefined) => String(nextValue ?? '') || EMPTY_VALUE
  const handleValueChange = (nextValue: string) => {
    const normalized = nextValue === EMPTY_VALUE ? '' : nextValue
    onValueChange?.(normalized)
    onChange?.({ target: { value: normalized }, currentTarget: { value: normalized } } as ChangeEvent<HTMLSelectElement>)
  }

  return (
    <div className={`ui-field ${className}`.trim()}>
      <LabelPrimitive.Root className="ui-field__label" htmlFor={id}>{label}</LabelPrimitive.Root>
      <SelectPrimitive.Root
        value={value === undefined ? undefined : normalize(value)}
        defaultValue={defaultValue === undefined ? undefined : normalize(defaultValue)}
        onValueChange={handleValueChange}
        {...props}
      >
        <SelectPrimitive.Trigger id={id} className="ui-field__control ui-select__trigger">
          <SelectPrimitive.Value />
          <SelectPrimitive.Icon className="ui-select__icon">▾</SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="ui-select__content" position="popper" sideOffset={6}>
            <SelectPrimitive.Viewport className="ui-select__viewport">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value || EMPTY_VALUE}
                  className="ui-select__item"
                  value={option.value || EMPTY_VALUE}
                  disabled={option.disabled}
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="ui-select__indicator">✓</SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  )
}
