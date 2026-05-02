import { useEffect, useMemo, useRef, useState } from 'react'
import './MultiSelectDropdown.css'

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectDropdownProps {
  id: string
  label: string
  options: MultiSelectOption[]
  selectedValues: string[]
  onChange: (nextValues: string[]) => void
  className?: string
  placeholder?: string
  allSelectedLabel?: string
  disabled?: boolean
}

export function MultiSelectDropdown({
  id,
  label,
  options,
  selectedValues,
  onChange,
  className = '',
  placeholder = 'Select options',
  allSelectedLabel = 'All selected',
  disabled = false,
}: MultiSelectDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues])

  const triggerText = useMemo(() => {
    if (selectedValues.length === 0) return placeholder
    if (selectedValues.length === options.length && options.length > 0) return allSelectedLabel
    if (selectedValues.length <= 2) {
      return options
        .filter((option) => selectedSet.has(option.value))
        .map((option) => option.label)
        .join(', ')
    }
    return `${selectedValues.length} selected`
  }, [allSelectedLabel, options, placeholder, selectedSet, selectedValues])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const toggleOption = (value: string) => {
    const next = new Set(selectedSet)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }
    const ordered = options.filter((option) => next.has(option.value)).map((option) => option.value)
    onChange(ordered)
  }

  return (
    <div className={`ui-field ui-multi-select ${className}`.trim()}>
      <label className="ui-field__label" htmlFor={id}>
        {label}
      </label>

      <div className="ui-multi-select__container" ref={containerRef}>
        <button
          id={id}
          type="button"
          className={`ui-field__control ui-multi-select__trigger${isOpen ? ' ui-multi-select__trigger--open' : ''}`}
          onClick={() => setIsOpen((prev) => !prev)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="ui-multi-select__trigger-text">{triggerText}</span>
          <span className="ui-multi-select__chevron" aria-hidden="true">
            ▾
          </span>
        </button>

        {isOpen && !disabled && (
          <div className="ui-multi-select__menu" role="listbox" aria-multiselectable="true">
            {options.length === 0 ? (
              <div className="ui-multi-select__empty">No options available</div>
            ) : (
              options.map((option) => (
                <label key={option.value} className="ui-multi-select__option">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(option.value)}
                    onChange={() => toggleOption(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
