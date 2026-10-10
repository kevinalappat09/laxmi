import { useMemo } from 'react'
import { Checkbox } from './Checkbox'
import { Popover } from './Popover'
import './MultiSelectDropdown.css'

export interface MultiSelectOption { value: string; label: string }

interface MultiSelectDropdownProps {
  id: string
  label: string
  options: MultiSelectOption[]
  value: string[]
  onValueChange: (nextValues: string[]) => void
  className?: string
  placeholder?: string
  allSelectedLabel?: string
  disabled?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function MultiSelectDropdown({ id, label, options, value, onValueChange, className = '', placeholder = 'Select options', allSelectedLabel = 'All selected', disabled = false, open, onOpenChange }: MultiSelectDropdownProps) {
  const selectedSet = useMemo(() => new Set(value), [value])
  const triggerText = useMemo(() => {
    if (value.length === 0) return placeholder
    if (value.length === options.length && options.length > 0) return allSelectedLabel
    if (value.length <= 2) return options.filter((option) => selectedSet.has(option.value)).map((option) => option.label).join(', ')
    return `${value.length} selected`
  }, [allSelectedLabel, options, placeholder, selectedSet, value])

  const toggleOption = (optionValue: string) => {
    const next = new Set(selectedSet)
    if (next.has(optionValue)) next.delete(optionValue)
    else next.add(optionValue)
    onValueChange(options.filter((option) => next.has(option.value)).map((option) => option.value))
  }

  const trigger = (
    <button id={id} type="button" className="ui-field__control ui-multi-select__trigger" disabled={disabled}>
      <span className="ui-multi-select__trigger-text">{triggerText}</span>
      <span className="ui-multi-select__chevron" aria-hidden="true">▾</span>
    </button>
  )

  return (
    <div className={`ui-field ui-multi-select ${className}`.trim()}>
      <label className="ui-field__label" htmlFor={id}>{label}</label>
      <Popover trigger={trigger} open={open} onOpenChange={onOpenChange} contentClassName="ui-multi-select__menu">
        {options.length === 0 ? <div className="ui-multi-select__empty">No options available</div> : options.map((option) => (
          <Checkbox key={option.value} id={`${id}-${option.value}`} label={option.label} checked={selectedSet.has(option.value)} onCheckedChange={() => toggleOption(option.value)} />
        ))}
      </Popover>
    </div>
  )
}
