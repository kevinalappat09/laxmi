import { useMemo, useState } from 'react'
import { Checkbox } from './Checkbox'
import { Input } from './Input'
import { Popover } from './Popover'
import './MultiSelectDropdown.css'
import './utilities.css'

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
  searchable?: boolean
  searchPlaceholder?: string
}

interface MultiSelectOptionsProps {
  id: string
  label: string
  options: MultiSelectOption[]
  selectedSet: Set<string>
  onToggle: (value: string) => void
  searchable: boolean
  searchPlaceholder: string
}

function MultiSelectOptions({ id, label, options, selectedSet, onToggle, searchable, searchPlaceholder }: MultiSelectOptionsProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const filteredOptions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
    if (!normalizedQuery) return options
    return options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedQuery))
  }, [options, searchQuery])

  return (
    <>
      {searchable && options.length > 0 && (
        <Input
          id={`${id}-search`}
          label={`Search ${label}`}
          hideLabel
          className="ui-multi-select__search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={searchPlaceholder}
          autoComplete="off"
        />
      )}
      {searchable && searchQuery.trim() && (
        <div className="ui-visually-hidden" role="status" aria-live="polite">
          {filteredOptions.length} matching {filteredOptions.length === 1 ? 'option' : 'options'}
        </div>
      )}
      <div className="ui-multi-select__options">
        {options.length === 0 ? (
          <div className="ui-multi-select__empty">No options available</div>
        ) : filteredOptions.length === 0 ? (
          <div className="ui-multi-select__empty" aria-hidden="true">No matching options</div>
        ) : filteredOptions.map((option) => (
          <Checkbox key={option.value} id={`${id}-${option.value}`} label={option.label} checked={selectedSet.has(option.value)} onCheckedChange={() => onToggle(option.value)} />
        ))}
      </div>
    </>
  )
}

export function MultiSelectDropdown({ id, label, options, value, onValueChange, className = '', placeholder = 'Select options', allSelectedLabel = 'All selected', disabled = false, open, onOpenChange, searchable = false, searchPlaceholder = 'Search options' }: MultiSelectDropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const effectiveOpen = open ?? internalOpen
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

  const handleOpenChange = (nextOpen: boolean) => {
    if (open === undefined) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
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
      <Popover trigger={trigger} open={effectiveOpen} onOpenChange={handleOpenChange} contentClassName={`ui-multi-select__menu${searchable ? ' ui-multi-select__menu--searchable' : ''}`}>
        <MultiSelectOptions
          id={id}
          label={label}
          options={options}
          selectedSet={selectedSet}
          onToggle={toggleOption}
          searchable={searchable}
          searchPlaceholder={searchPlaceholder}
        />
      </Popover>
    </div>
  )
}
