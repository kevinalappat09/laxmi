import { useMemo } from 'react'
import {
  assignSeriesColors,
  buildBarOption,
  buildDivergingBarOption,
  buildMultiLineOption,
  buildPieOption,
  getSemanticChartColors,
} from '../../../../utils/reportOptions'
import { collapseToTopN } from '../../../../utils/chartUtils'
import { formatCurrency, formatPercent, formatSignedCurrency } from '../../../../utils/formatters'
import { MetricCard } from '../../components/MetricCard'
import { ReportChartCard } from '../../components/ReportChartCard'
import { SectionStatus } from '../../components/SectionStatus'
import { usePortfolioReportData } from '../../hooks/usePortfolioReportData'

const INVESTED_SERIES = 'Invested'
const VALUE_SERIES = 'Current Value'

const CATEGORY_LABELS: Record<string, string> = {
  EQUITY: 'Equity',
  DEBT: 'Debt',
}

function formatMonthLabel(month: string): string {
  const [year, monthPart] = month.split('-')
  const date = new Date(Number(year), Number(monthPart) - 1, 1)
  if (Number.isNaN(date.getTime())) return month
  return date.toLocaleString(undefined, { month: 'short', year: '2-digit' })
}

export function PortfolioSection() {
  const { summary, valueHistory, isLoading, error } = usePortfolioReportData()
  const colors = useMemo(() => getSemanticChartColors(), [])

  const valueHistoryData = useMemo(
    () =>
      valueHistory.map((point) => ({
        label: point.date,
        [INVESTED_SERIES]: Math.round(point.invested),
        [VALUE_SERIES]: Math.round(point.currentValue),
      })),
    [valueHistory]
  )

  const valueHistoryOption = useMemo(
    () =>
      buildMultiLineOption(valueHistoryData, [INVESTED_SERIES, VALUE_SERIES], {
        [INVESTED_SERIES]: colors.neutral,
        [VALUE_SERIES]: colors.accent,
      }),
    [valueHistoryData, colors]
  )

  const categoryAllocation = useMemo(
    () =>
      (summary?.allocation.byCategory ?? []).map((entry) => ({
        name: CATEGORY_LABELS[entry.category] ?? entry.category,
        value: Number(entry.value.toFixed(2)),
      })),
    [summary]
  )

  const assetAllocation = useMemo(
    () =>
      collapseToTopN(
        (summary?.allocation.byAsset ?? []).map((entry) => ({
          name: entry.name,
          value: Number(entry.value.toFixed(2)),
        }))
      ),
    [summary]
  )

  const allocationColorMap = useMemo(
    () => assignSeriesColors(assetAllocation.map((entry) => entry.name)),
    [assetAllocation]
  )

  const categoryOption = useMemo(() => buildPieOption(categoryAllocation), [categoryAllocation])
  const assetOption = useMemo(
    () => buildPieOption(assetAllocation, allocationColorMap),
    [assetAllocation, allocationColorMap]
  )

  const monthlyData = useMemo(
    () =>
      (summary?.monthlyInvestments ?? []).map((entry) => ({
        label: formatMonthLabel(entry.month),
        value: Math.round(entry.amount),
      })),
    [summary]
  )

  const monthlyOption = useMemo(
    () => buildBarOption(monthlyData, 'Invested', { color: colors.accent }),
    [monthlyData, colors]
  )

  const holdingsPlData = useMemo(() => {
    const assets = summary?.assets ?? []
    return [...assets]
      .sort((a, b) => b.totalPl - a.totalPl)
      .slice(0, 10)
      .map((asset) => ({ label: asset.name, value: Number(asset.totalPl.toFixed(2)) }))
  }, [summary])

  const holdingsPlOption = useMemo(
    () => buildDivergingBarOption(holdingsPlData, 'Total P&L'),
    [holdingsPlData]
  )

  return (
    <>
      <SectionStatus isLoading={isLoading} error={error} />

      {!isLoading && !summary ? (
        <p className="reports-page__loading">No portfolio data yet. Add a fund on the Portfolio page.</p>
      ) : (
        <>
          {summary && (
            <div className="reports-page__metrics">
              <MetricCard label="Current Value" value={formatCurrency(summary.totalCurrentValue, 0)} />
              <MetricCard label="Invested" value={formatCurrency(summary.totalInvested, 0)} />
              <MetricCard
                label="Total Return"
                value={formatSignedCurrency(summary.totalPl, 0)}
                caption={formatPercent(summary.totalUnrealizedPlPct)}
                tone={summary.totalPl >= 0 ? 'positive' : 'negative'}
              />
              <MetricCard
                label="XIRR"
                value={formatPercent(summary.xirr != null ? summary.xirr * 100 : null)}
                caption="Annualized, money-weighted"
              />
            </div>
          )}

          <div className="reports-page__charts">
            <ReportChartCard
              title="Invested vs Current Value"
              subtitle="Cumulative cost against market value from the start of your range"
              option={valueHistoryOption}
              hasData={valueHistoryData.length > 0}
              emptyMessage="No price history in this range yet. Refresh prices on the Portfolio page."
              fullWidth
            />
            <ReportChartCard
              title="Allocation by Category"
              subtitle="Equity against debt exposure"
              option={categoryOption}
              hasData={categoryAllocation.length > 0}
            />
            <ReportChartCard
              title="Allocation by Fund"
              subtitle="Current value per holding"
              option={assetOption}
              hasData={assetAllocation.length > 0}
            />
            <ReportChartCard
              title="Invested per Month"
              subtitle="Buys and SIPs over the last twelve months"
              option={monthlyOption}
              hasData={monthlyData.some((point) => point.value > 0)}
            />
            <ReportChartCard
              title="Top Holdings by Return"
              subtitle="Realized and unrealized profit per fund"
              option={holdingsPlOption}
              hasData={holdingsPlData.length > 0}
            />
          </div>
        </>
      )}
    </>
  )
}
