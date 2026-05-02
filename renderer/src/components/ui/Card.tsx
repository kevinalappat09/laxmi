import type { HTMLAttributes, ReactNode } from 'react'
import './Card.css'

type CardPadding = 'default' | 'tight' | 'none'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: CardPadding
  asButton?: boolean
}

export function Card({ children, padding = 'default', className = '', asButton = false, ...props }: CardProps) {
  const classes = ['ui-card', `ui-card--padding-${padding}`]
  if (asButton) classes.push('ui-card--button')
  if (className) classes.push(className)

  return (
    <div className={classes.join(' ')} {...props}>
      {children}
    </div>
  )
}
