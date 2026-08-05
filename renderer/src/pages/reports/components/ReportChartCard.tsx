import type { EChartsOption } from 'echarts'
import ReactECharts from 'echarts-for-react'
import { Card } from '../../../components/ui/Card'
import { CHART_HEIGHT } from '../../../utils/reportOptions'

interface ReportChartCardProps {
  title: string
  subtitle: string
  option: EChartsOption
  hasData: boolean
}

export function ReportChartCard({ title, subtitle, option, hasData }: ReportChartCardProps) {
  return (
    <Card className="reports-page__chart-card">
      <div className="reports-page__chart-header">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {hasData ? (
        <ReactECharts
          option={option}
          notMerge
          style={{ height: CHART_HEIGHT, width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      ) : (
        <div className="reports-page__chart-empty" style={{ height: CHART_HEIGHT }}>
          No data for selected filters.
        </div>
      )}
    </Card>
  )
}
