import { Card, Metric } from '../../../components/ui'

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
      <Metric
        label={label}
        value={value}
        detail={caption}
        tone={tone === 'neutral' ? 'default' : tone}
        className={`reports-metric-card__metric reports-metric-card__metric--${tone}`}
      />
    </Card>
  )
}
