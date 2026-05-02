import type { HTMLAttributes, ReactNode } from 'react'
import './Tag.css'

type TagColor = 'default' | 'positive' | 'negative' | 'info'

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  color?: TagColor
}

export function Tag({ children, color = 'default', className = '', ...props }: TagProps) {
  const classes = ['ui-tag', `ui-tag--${color}`]
  if (className) classes.push(className)
  return (
    <span className={classes.join(' ')} {...props}>
      {children}
    </span>
  )
}
