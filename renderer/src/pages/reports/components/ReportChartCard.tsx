import type { EChartsOption } from 'echarts'
import ReactECharts from 'echarts-for-react'
import { Card } from '../../../components/ui/Card'
import { CHART_HEIGHT } from '../../../utils/reportOptions'

interface ReportChartCardProps {
  title: string
  subtitle: string
  option: EChartsOption
  hasData: boolean
  /** Charts whose height depends on row count, such as horizontal bars, can override this. */
  height?: number
  emptyMessage?: string
  fullWidth?: boolean
}

export function ReportChartCard({
  title,
  subtitle,
  option,
  hasData,
  height = CHART_HEIGHT,
  emptyMessage = 'No data for selected filters.',
  fullWidth = false,
}: ReportChartCardProps) {
  const className = fullWidth
    ? 'reports-page__chart-card reports-page__chart-card--full'
    : 'reports-page__chart-card'

  return (
    <Card className={className}>
      <div className="reports-page__chart-header">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {hasData ? (
        <ReactECharts
          option={option}
          notMerge
          style={{ height, width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      ) : (
        <div className="reports-page__chart-empty" style={{ height }}>
          {emptyMessage}
        </div>
      )}
    </Card>
  )
}
