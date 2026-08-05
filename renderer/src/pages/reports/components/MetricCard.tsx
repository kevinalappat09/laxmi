import { Card } from '../../../components/ui/Card'

export type MetricTone = 'neutral' | 'positive' | 'negative'

interface MetricCardProps {
  label: string
  value: string
  caption?: string
  tone?: MetricTone
}

export function MetricCard({ label, value, caption, tone = 'neutral' }: MetricCardProps) {
  return (
    <Card className="reports-metric-card">
      <span className="reports-metric-card__label">{label}</span>
      <span className={`reports-metric-card__value reports-metric-card__value--${tone}`}>{value}</span>
      {caption && <span className="reports-metric-card__caption">{caption}</span>}
    </Card>
  )
}
