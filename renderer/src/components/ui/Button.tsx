import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.css'

type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'danger' | 'icon' | 'pill' | 'ghost' | 'square'
type ButtonSize = 'sm' | 'md' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  const classes = ['ui-button', `ui-button--variant-${variant}`, `ui-button--size-${size}`]
  if (className) classes.push(className)

  return (
    <button type={type} className={classes.join(' ')} {...props}>
      {children}
    </button>
  )
}
