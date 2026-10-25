import { useEffect, useState, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'
import type { PortfolioAsset } from '../../../../src/types/portfolioAsset'
import type { AssetSubCategory } from '../../../../src/types/portfolioAsset'
import type { PriceRefreshResult, PortfolioSummaryAnalytics, AssetAnalytics, PortfolioValuePoint } from '../../../../src/types/portfolioAnalytics'
import { AlertDialog, Button, Card, EmptyState, PageHeader, SegmentedControl, StatusMessage, TableContainer } from '../../components/ui'
import { chartFontSize, escapeTooltipText, getChartPalette } from '../../utils/reportOptions'
import { AssetDialog } from './AssetDialog'
import { TransactionDialog } from './TransactionDialog'
import { useNavigation } from '../../contexts/NavigationContext'
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
  formatSignedCurrency,
  formatSignedPercent,
} from '../../utils/formatters'
import './PortfolioPage.css'

function getStalenessLabel(asset: PortfolioAsset): { label: string; state: 'fresh' | 'stale' | 'never' } {
  if (!asset.lastPriceUpdatedAt) return { label: 'Never updated', state: 'never' }
  const elapsed = Date.now() - new Date(asset.lastPriceUpdatedAt).getTime()
  const thresholdMs = asset.priceSource === 'YAHOO' ? 15 * 60 * 1000 : 6 * 60 * 60 * 1000
  const isStale = elapsed > thresholdMs
  const minutes = Math.floor(elapsed / 60000)
  const hours = Math.floor(elapsed / 3600000)
  const label = hours > 0 ? `Updated ${hours} hr${hours > 1 ? 's' : ''} ago` : `Updated ${minutes} min${minutes !== 1 ? 's' : ''} ago`
  return { label, state: isStale ? 'stale' : 'fresh' }
}

/* ------------------------------------------------------------------ */
/* Sub-category tab config                                             */
/* ------------------------------------------------------------------ */

const TAB_ORDER: (AssetSubCategory | 'all')[] = [
  'all', 'large_cap', 'mid_cap', 'small_cap', 'flexi_cap',
  'index', 'elss', 'liquid', 'debt', 'hybrid', 'international',
]
const TAB_LABELS: Record<string, string> = {
  all: 'All', large_cap: 'Large Cap', mid_cap: 'Mid Cap', small_cap: 'Small Cap',
  flexi_cap: 'Flexi Cap', index: 'Index', elss: 'ELSS', liquid: 'Liquid',
  debt: 'Debt', hybrid: 'Hybrid', international: 'International',
}

/* ------------------------------------------------------------------ */
/* Value history date range helpers                                    */
/* ------------------------------------------------------------------ */

type DateRange = '1M' | '3M' | '6M' | '1Y' | 'All'

function fromDateForRange(range: DateRange): string {
  const d = new Date()
  if (range === '1M') d.setMonth(d.getMonth() - 1)
  else if (range === '3M') d.setMonth(d.getMonth() - 3)
  else if (range === '6M') d.setMonth(d.getMonth() - 6)
  else if (range === '1Y') d.setFullYear(d.getFullYear() - 1)
  else return '1970-01-01'
  return d.toISOString().split('T')[0]
}

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

export function PortfolioPage() {
  const { selectAsset } = useNavigation()

  const [assets, setAssets] = useState<PortfolioAsset[]>([])
  const [summary, setSummary] = useState<PortfolioSummaryAnalytics | null>(null)
  const [valueHistory, setValueHistory] = useState<PortfolioValuePoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [txnDialog, setTxnDialog] = useState<{ asset?: PortfolioAsset; defaultType: 'BUY' | 'SELL' } | null>(null)
  const [editingAsset, setEditingAsset] = useState<PortfolioAsset | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshWarning, setRefreshWarning] = useState<PriceRefreshResult | null>(null)
  const [activeTab, setActiveTab] = useState<AssetSubCategory | 'all'>('all')
  const [valueRange, setValueRange] = useState<DateRange>('1Y')
  const [deletingAssetId, setDeletingAssetId] = useState<number | null>(null)

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [assetList, summaryData] = await Promise.all([
        window.financeAPI.portfolio.asset.list(),
        window.financeAPI.portfolio.analytics.summary(),
      ])
      setAssets(assetList)
      setSummary(summaryData)
    } catch (err) {
      console.error(err)
      setError('Failed to load portfolio.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadValueHistory = useCallback(async (range: DateRange) => {
    try {
      const from = fromDateForRange(range)
      const data = await window.financeAPI.portfolio.analytics.valueHistory(from)
      setValueHistory(data)
    } catch (err) {
      console.error('Value history load failed:', err)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { loadValueHistory(valueRange) }, [valueRange, loadValueHistory])

  const handleDeleteAsset = async (assetId: number) => {
    try {
      await window.financeAPI.portfolio.asset.deactivate(assetId)
      await loadAll()
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeletingAssetId(null)
    }
  }

  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    setRefreshWarning(null)
    try {
      const result = await window.financeAPI.portfolio.prices.refreshAll()
      if (result.failedAssets.length > 0) setRefreshWarning(result)
      await loadAll()
    } catch (err) {
      console.error('Refresh failed:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  const analyticsMap = new Map(summary?.assets.map(a => [a.assetId, a]) ?? [])

  const visibleTabs = TAB_ORDER.filter(tab => {
    if (tab === 'all') return true
    return assets.some(a => a.subCategory === tab)
  })

  const filteredAssets: PortfolioAsset[] = activeTab === 'all'
    ? assets
    : assets.filter(a => a.subCategory === activeTab)

  return (
    <div className="portfolio-page">
      {/* ── Header ── */}
      <PageHeader
        title="Portfolio"
        actions={(
          <>
          <Button variant="pill" onClick={handleRefreshAll} disabled={isRefreshing}>
            {isRefreshing ? '↻ Fetching Current Prices…' : '↻ Fetch Current Prices'}
          </Button>
          <Button variant="pill" onClick={() => setTxnDialog({ defaultType: 'BUY' })}>+ Add Transaction</Button>
          </>
        )}
      />

      {refreshWarning && (
        <StatusMessage tone="warning" className="portfolio-page__warning-banner" onDismiss={() => setRefreshWarning(null)} dismissLabel="Dismiss price refresh warning">
          Price refresh failed for: {refreshWarning.failedAssets.map(a => a.name).join(', ')}
        </StatusMessage>
      )}

      {isLoading && <p className="portfolio-page__loading">Loading…</p>}
      {error && <p className="portfolio-page__error">{error}</p>}

      {!isLoading && !error && (
        <>
          {/* ── Summary bar ── */}
          {summary && summary.assets.length > 0 && (
            <SummaryBar summary={summary} />
          )}

          {/* ── Empty state ── */}
          {assets.length === 0 && (
            <EmptyState
              className="portfolio-page__empty"
              title="No transactions yet"
              description="Add your first transaction to start tracking your portfolio."
              action={<Button variant="pill" onClick={() => setTxnDialog({ defaultType: 'BUY' })}>+ Add Transaction</Button>}
            />
          )}

          {/* ── Charts ── */}
          {summary && summary.assets.length > 0 && (
            <>
              <div className="portfolio-page__charts-row">
                <AllocationChart summary={summary} />
                <MonthlyChart summary={summary} />
              </div>
              <ValueHistoryChart
                data={valueHistory}
                range={valueRange}
                onRangeChange={(r) => setValueRange(r)}
              />
            </>
          )}

          {/* ── Tabbed fund list ── */}
          {assets.length > 0 && (
            <div className="portfolio-page__fund-section">
              <SegmentedControl className="portfolio-page__tabs" ariaLabel="Portfolio category" value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} options={visibleTabs.map((tab) => ({ value: tab, label: TAB_LABELS[tab] }))} />

              <TableContainer>
                <table className="portfolio-page__table">
                <thead>
                  <tr>
                    <th>Fund</th>
                    <th className="portfolio-page__col-right">Invested</th>
                    <th className="portfolio-page__col-right">Current</th>
                    <th className="portfolio-page__col-right">P&amp;L</th>
                    <th className="portfolio-page__col-right">XIRR</th>
                    <th className="portfolio-page__col-right">Day</th>
                    <th className="portfolio-page__col-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map(rawAsset => {
                    const a = analyticsMap.get(rawAsset.id) ?? null
                    return (
                      <FundRow
                        key={rawAsset.id}
                        analytics={a}
                        rawAsset={rawAsset}
                        onRowClick={() => selectAsset(rawAsset.id)}
                        onEdit={() => setEditingAsset(rawAsset)}
                        onBuy={() => setTxnDialog({ asset: rawAsset, defaultType: 'BUY' })}
                        onSell={() => setTxnDialog({ asset: rawAsset, defaultType: 'SELL' })}
                        onDelete={() => setDeletingAssetId(rawAsset.id)}
                      />
                    )
                  })}
                  {filteredAssets.length > 1 && (
                    <SubtotalRow assets={filteredAssets.map(a => analyticsMap.get(a.id)).filter((a): a is AssetAnalytics => a != null)} />
                  )}
                </tbody>
                </table>
              </TableContainer>
            </div>
          )}

          {/* ── Delete confirmation ── */}
          <AlertDialog
            open={deletingAssetId != null}
            onOpenChange={(open) => { if (!open) setDeletingAssetId(null) }}
            title="Remove fund?"
            description={`"${assets.find((asset) => asset.id === deletingAssetId)?.name ?? 'This fund'}" will be removed from your portfolio. This cannot be undone.`}
            confirmLabel="Remove"
            onConfirm={() => { if (deletingAssetId != null) void handleDeleteAsset(deletingAssetId) }}
          />
        </>
      )}

      {txnDialog && (
        <TransactionDialog
          asset={txnDialog.asset}
          defaultType={txnDialog.defaultType}
          onClose={() => setTxnDialog(null)}
          onSaved={() => { setTxnDialog(null); loadAll() }}
        />
      )}

      {editingAsset && (
        <AssetDialog
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
          onSaved={() => { setEditingAsset(null); loadAll() }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Summary bar                                                         */
/* ------------------------------------------------------------------ */

function SummaryBar({ summary }: { summary: PortfolioSummaryAnalytics }) {
  const plColor = summary.totalUnrealizedPl >= 0 ? 'var(--color-positive)' : 'var(--color-error)'
  const dayColor = (summary.dayGainLoss ?? 0) >= 0 ? 'var(--color-positive)' : 'var(--color-error)'

  return (
    <Card className="portfolio-summary-bar" padding="none">
      <SummaryTile label="Total Value" value={formatCurrency(summary.totalCurrentValue, 0)} />
      <SummaryTile
        label="Day Gain/Loss"
        value={`${formatSignedCurrency(summary.dayGainLoss)} (${formatSignedPercent(summary.dayGainLossPct)})`}
        color={dayColor}
      />
      <SummaryTile
        label="Total Return"
        value={`${formatSignedCurrency(summary.totalPl)} (${formatSignedPercent(summary.totalUnrealizedPlPct)})`}
        color={plColor}
      />
      <SummaryTile label="XIRR" value={formatPercent(summary.xirr != null ? summary.xirr * 100 : null)} />
    </Card>
  )
}

function SummaryTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="portfolio-summary-tile">
      <span className="portfolio-summary-tile__value" style={color ? { color } : undefined}>{value}</span>
      <span className="portfolio-summary-tile__label">{label}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Allocation pie chart                                                */
/* ------------------------------------------------------------------ */

function AllocationChart({ summary }: { summary: PortfolioSummaryAnalytics }) {
  const data = summary.allocation.byCategory.map(c => ({
    name: c.category,
    value: Math.round(c.value),
  }))

  const palette = getChartPalette()

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {d}%',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: { color: palette.tooltipText, fontSize: chartFontSize(14) },
    },
    legend: { orient: 'vertical', right: 10, top: 'middle', textStyle: { fontSize: chartFontSize(14), color: palette.axisTextColor } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['40%', '50%'],
      data,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: chartFontSize(14), fontWeight: 'bold' } },
    }],
    color: [palette.accentColor, palette.blueColor, palette.incomeColor, palette.expenseColor],
  }

  return (
    <Card className="portfolio-chart-card" padding="tight">
      <p className="portfolio-chart-card__title">Allocation by Category</p>
      <ReactECharts option={option} style={{ height: 180 }} />
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Monthly investment bar chart                                        */
/* ------------------------------------------------------------------ */

function MonthlyChart({ summary }: { summary: PortfolioSummaryAnalytics }) {
  const months = summary.monthlyInvestments.map(m => {
    const [y, mo] = m.month.split('-')
    return new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleString('en-IN', { month: 'short' })
  })
  const amounts = summary.monthlyInvestments.map(m => Math.round(m.amount))

  const palette = getChartPalette()

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (p: any) => `${escapeTooltipText(p[0].name)}: ${formatCurrency(p[0].value, 0)}`,
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: { color: palette.tooltipText, fontSize: chartFontSize(14) },
    },
    xAxis: { type: 'category', data: months, axisLabel: { fontSize: chartFontSize(14), color: palette.axisTextColor }, axisLine: { lineStyle: { color: palette.gridColor } } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrencyCompact(v), fontSize: chartFontSize(14), color: palette.axisTextColor }, splitLine: { lineStyle: { color: palette.gridColor } } },
    series: [{ type: 'bar', data: amounts, itemStyle: { color: palette.accentColor, borderRadius: [3, 3, 0, 0] } }],
    grid: { left: 64, right: 10, top: 20, bottom: 42 },
  }

  return (
    <Card className="portfolio-chart-card" padding="tight">
      <p className="portfolio-chart-card__title">Invested per Month</p>
      <ReactECharts option={option} style={{ height: 180 }} />
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Portfolio value over time chart                                     */
/* ------------------------------------------------------------------ */

function ValueHistoryChart({ data, range, onRangeChange }: {
  data: PortfolioValuePoint[]
  range: DateRange
  onRangeChange: (r: DateRange) => void
}) {
  const RANGES: DateRange[] = ['1M', '3M', '6M', '1Y', 'All']

  if (data.length === 0) {
    return (
      <Card className="portfolio-chart-card portfolio-chart-card--full" padding="tight">
        <div className="portfolio-chart-card__header">
          <p className="portfolio-chart-card__title">Portfolio Value</p>
          <div className="portfolio-chart-card__range-btns">
            {RANGES.map(r => (
              <Button key={r} variant={range === r ? 'primary' : 'subtle'} size="sm" className="portfolio-range-btn" onClick={() => onRangeChange(r)}>{r}</Button>
            ))}
          </div>
        </div>
        <p className="portfolio-chart-card__empty">Start tracking your portfolio by adding a fund and its first transaction.</p>
      </Card>
    )
  }

  const dates    = data.map(d => d.date)
  const invested = data.map(d => Math.round(d.invested))
  const values   = data.map(d => Math.round(d.currentValue))

  const palette = getChartPalette()

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: { color: palette.tooltipText, fontSize: chartFontSize(14) },
      formatter: (params: any) => {
        const d = params[0].name
        const inv = params.find((p: any) => p.seriesName === 'Invested')?.value ?? 0
        const val = params.find((p: any) => p.seriesName === 'Current Value')?.value ?? 0
        return `${escapeTooltipText(d)}<br/>Invested: ${formatCurrency(inv, 0)}<br/>Current: ${formatCurrency(val, 0)}`
      },
    },
    legend: { bottom: 0, data: ['Invested', 'Current Value'], textStyle: { color: palette.axisTextColor, fontSize: chartFontSize(14) } },
    xAxis: { type: 'category', data: dates, axisLabel: { fontSize: chartFontSize(14), rotate: 30, color: palette.axisTextColor }, axisLine: { lineStyle: { color: palette.gridColor } } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrencyCompact(v), fontSize: chartFontSize(14), color: palette.axisTextColor }, splitLine: { lineStyle: { color: palette.gridColor } } },
    series: [
      { name: 'Invested', type: 'line', data: invested, step: 'end', lineStyle: { color: palette.axisTextColor }, itemStyle: { color: palette.axisTextColor }, areaStyle: { color: palette.neutralAreaColor }, symbol: 'none' },
      { name: 'Current Value', type: 'line', data: values, smooth: true, lineStyle: { color: palette.accentColor }, itemStyle: { color: palette.accentColor }, areaStyle: { color: palette.accentAreaColor }, symbol: 'none' },
    ],
    grid: { left: 72, right: 20, top: 20, bottom: 64 },
  }

  return (
    <Card className="portfolio-chart-card portfolio-chart-card--full" padding="tight">
      <div className="portfolio-chart-card__header">
        <p className="portfolio-chart-card__title">Portfolio Value</p>
        <div className="portfolio-chart-card__range-btns">
          {RANGES.map(r => (
            <Button key={r} variant={range === r ? 'primary' : 'subtle'} size="sm" className="portfolio-range-btn" onClick={() => onRangeChange(r)}>{r}</Button>
          ))}
        </div>
      </div>
      <ReactECharts option={option} style={{ height: 220 }} />
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Fund row                                                            */
/* ------------------------------------------------------------------ */

interface FundRowProps {
  analytics: AssetAnalytics | null
  rawAsset: PortfolioAsset
  onRowClick: () => void
  onEdit: () => void
  onBuy: () => void
  onSell: () => void
  onDelete: () => void
}

function FundRow({ analytics: a, rawAsset, onRowClick, onEdit, onBuy, onSell, onDelete }: FundRowProps) {
  const plColor = (a?.unrealizedPl ?? 0) >= 0 ? 'var(--color-positive)' : 'var(--color-error)'
  const dayColor = (a?.dayGainLoss ?? 0) >= 0 ? 'var(--color-positive)' : 'var(--color-error)'
  const staleness = getStalenessLabel(rawAsset)

  return (
    <tr className="portfolio-page__row">
      <td className="portfolio-page__cell-name">
        <Button variant="subtle" className="portfolio-page__fund-link" onClick={onRowClick}>{rawAsset.name}</Button>
        {rawAsset.subCategory && <span className="portfolio-page__fund-tag">{TAB_LABELS[rawAsset.subCategory] ?? rawAsset.subCategory}</span>}
        {a == null
          ? <span className="portfolio-page__staleness portfolio-page__staleness--never">No transactions yet</span>
          : (
            <span className={`portfolio-page__staleness portfolio-page__staleness--${staleness.state}`}>
              {staleness.state === 'stale' ? `Stale — ${staleness.label.toLowerCase()}` : staleness.label}
            </span>
          )
        }
      </td>
      <td className="portfolio-page__col-right">{a ? formatCurrency(a.totalInvested, 0) : '—'}</td>
      <td className="portfolio-page__col-right">
        {a ? (
          <>
            <div>{formatCurrency(a.currentValue, 0)}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>{a.totalUnits.toFixed(3)} units</div>
          </>
        ) : '—'}
      </td>
      <td className="portfolio-page__col-right" style={{ color: a ? plColor : undefined }}>
        {a ? (
          <>
            <div>{formatSignedCurrency(a.unrealizedPl)}</div>
            <div style={{ fontSize: '0.72rem' }}>{formatSignedPercent(a.unrealizedPlPct)}</div>
          </>
        ) : '—'}
      </td>
      <td className="portfolio-page__col-right">{a ? formatPercent(a.xirr != null ? a.xirr * 100 : null) : '—'}</td>
      <td className="portfolio-page__col-right" style={{ color: a ? dayColor : undefined }}>{a ? formatSignedCurrency(a.dayGainLoss) : '—'}</td>
      <td className="portfolio-page__col-actions">
        <div className="portfolio-page__action-group">
          <Button variant="secondary" size="sm" onClick={onEdit}>Edit</Button>
          <Button variant="secondary" size="sm" onClick={onBuy}>Buy More</Button>
          <Button variant="secondary" size="sm" onClick={onSell}>Sell</Button>
          <Button variant="danger" size="sm" onClick={onDelete}>Delete</Button>
        </div>
      </td>
    </tr>
  )
}

/* ------------------------------------------------------------------ */
/* Subtotal row                                                        */
/* ------------------------------------------------------------------ */

function SubtotalRow({ assets }: { assets: AssetAnalytics[] }) {
  const totalInvested = assets.reduce((s, a) => s + a.totalInvested, 0)
  const totalCurrent  = assets.reduce((s, a) => s + a.currentValue, 0)
  const totalPl       = assets.reduce((s, a) => s + a.unrealizedPl, 0)
  const plColor       = totalPl >= 0 ? 'var(--color-positive)' : 'var(--color-error)'

  return (
    <tr className="portfolio-page__subtotal-row">
      <td><span className="portfolio-page__subtotal-label">Subtotal</span></td>
      <td className="portfolio-page__col-right">{formatCurrency(totalInvested, 0)}</td>
      <td className="portfolio-page__col-right">{formatCurrency(totalCurrent, 0)}</td>
      <td className="portfolio-page__col-right" style={{ color: plColor }}>{formatSignedCurrency(totalPl)}</td>
      <td className="portfolio-page__col-right"></td>
      <td className="portfolio-page__col-right"></td>
      <td></td>
    </tr>
  )
}
