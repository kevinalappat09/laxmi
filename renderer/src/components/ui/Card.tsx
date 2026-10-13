import type { HTMLAttributes, ReactNode } from 'react'
import './Card.css'

type CardPadding = 'default' | 'tight' | 'none'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: CardPadding
}

export function Card({ children, padding = 'default', className = '', ...props }: CardProps) {
  const classes = ['ui-card', `ui-card--padding-${padding}`]
  if (className) classes.push(className)

  return <div className={classes.join(' ')} {...props}>{children}</div>
}
