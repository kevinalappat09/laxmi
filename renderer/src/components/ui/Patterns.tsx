import type { HTMLAttributes, ReactNode } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import './Patterns.css'

interface PageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  leading?: ReactNode
}

export function PageHeader({ title, description, actions, leading, className = '', ...props }: PageHeaderProps) {
  return (
    <header className={`ui-page-header ${className}`.trim()} {...props}>
      <div className="ui-page-header__main">
        {leading}
        <div>
          <h1 className="ui-page-header__title">{title}</h1>
          {description && <p className="ui-page-header__description">{description}</p>}
        </div>
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </header>
  )
}

interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  padding?: 'default' | 'tight' | 'none'
}

export function Panel({ title, description, actions, children, className = '', padding = 'default', ...props }: PanelProps) {
  return (
    <Card className={`ui-panel ${className}`.trim()} padding={padding} {...props}>
      {(title || description || actions) && (
        <div className="ui-panel__header">
          <div>
            {title && <h2 className="ui-panel__title">{title}</h2>}
            {description && <p className="ui-panel__description">{description}</p>}
          </div>
          {actions && <div className="ui-panel__actions">{actions}</div>}
        </div>
      )}
      {children}
    </Card>
  )
}

interface MetricProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode
  value: ReactNode
  detail?: ReactNode
  tone?: 'default' | 'positive' | 'negative'
}

export function Metric({ label, value, detail, tone = 'default', className = '', ...props }: MetricProps) {
  return (
    <div className={`ui-metric ui-metric--${tone} ${className}`.trim()} {...props}>
      <span className="ui-metric__label">{label}</span>
      <strong className="ui-metric__value">{value}</strong>
      {detail && <span className="ui-metric__detail">{detail}</span>}
    </div>
  )
}

interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, description, action, className = '', ...props }: EmptyStateProps) {
  return (
    <div className={`ui-empty-state ${className}`.trim()} {...props}>
      <strong className="ui-empty-state__title">{title}</strong>
      {description && <p className="ui-empty-state__description">{description}</p>}
      {action && <div className="ui-empty-state__action">{action}</div>}
    </div>
  )
}

interface StatusMessageProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'info' | 'success' | 'warning' | 'error'
  children: ReactNode
  onDismiss?: () => void
  dismissLabel?: string
}

export function StatusMessage({ tone = 'info', children, onDismiss, dismissLabel = 'Dismiss', className = '', ...props }: StatusMessageProps) {
  return (
    <div className={`ui-status-message ui-status-message--${tone} ${className}`.trim()} role={tone === 'error' ? 'alert' : 'status'} {...props}>
      <span>{children}</span>
      {onDismiss && (
        <Button variant="icon" size="icon" onClick={onDismiss} aria-label={dismissLabel}>×</Button>
      )}
    </div>
  )
}

interface TableContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function TableContainer({ children, className = '', ...props }: TableContainerProps) {
  return <div className={`ui-table-container ${className}`.trim()} {...props}>{children}</div>
}

export interface SegmentedOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

interface SegmentedControlProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  ariaLabel: string
  options: SegmentedOption[]
  value: string
  onValueChange: (value: string) => void
  size?: 'sm' | 'md'
}

export function SegmentedControl({ ariaLabel, options, value, onValueChange, size = 'md', className = '', ...props }: SegmentedControlProps) {
  return (
    <div className={`ui-segmented ui-segmented--${size} ${className}`.trim()} role="group" aria-label={ariaLabel} {...props}>
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? 'primary' : 'subtle'}
          size={size}
          aria-pressed={value === option.value}
          disabled={option.disabled}
          onClick={() => onValueChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
