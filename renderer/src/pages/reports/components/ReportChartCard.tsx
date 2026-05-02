import type { EChartsOption } from 'echarts'
import ReactECharts from 'echarts-for-react'
import { Card } from '../../../components/ui/Card'

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
        <ReactECharts option={option} style={{ height: 280, width: '100%' }} />
      ) : (
        <div className="reports-page__chart-empty">No data for selected filters.</div>
      )}
    </Card>
  )
}
