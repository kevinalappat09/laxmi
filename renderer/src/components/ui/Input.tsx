import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import './Input.css'

interface BaseFieldProps {
  label: string
  id: string
  className?: string
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>, BaseFieldProps {}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>, BaseFieldProps {
  children: ReactNode
}

export function Input({ label, id, className = '', ...props }: InputProps) {
  return (
    <div className={`ui-field ${className}`.trim()}>
      <label className="ui-field__label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="ui-field__control" {...props} />
    </div>
  )
}

export function Select({ label, id, className = '', children, ...props }: SelectProps) {
  return (
    <div className={`ui-field ${className}`.trim()}>
      <label className="ui-field__label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="ui-field__control" {...props}>
        {children}
      </select>
    </div>
  )
}
