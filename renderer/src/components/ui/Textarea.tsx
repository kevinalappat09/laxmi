import type { TextareaHTMLAttributes } from 'react'
import './Input.css'
import './controls.css'

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  id: string
  label: string
  className?: string
}

export function Textarea({ id, label, className = '', ...props }: TextareaProps) {
  return (
    <div className={`ui-field ${className}`.trim()}>
      <label className="ui-field__label" htmlFor={id}>{label}</label>
      <textarea id={id} className="ui-field__control ui-textarea" {...props} />
    </div>
  )
}
