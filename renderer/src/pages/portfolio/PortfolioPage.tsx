import { useEffect, useState, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'

function readVar(token: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return v || fallback
}
import type { PortfolioAsset } from '../../../../src/types/portfolioAsset'
import type { AssetSubCategory } from '../../../../src/types/portfolioAsset'
import type { PriceRefreshResult, PortfolioSummaryAnalytics, AssetAnalytics, PortfolioValuePoint } from '../../../../src/types/portfolioAnalytics'
import { Button } from '../../components/ui/Button'
import { TransactionDialog } from './TransactionDialog'
import { useNavigation } from '../../contexts/NavigationContext'
import './PortfolioPage.css'

/* ------------------------------------------------------------------ */
/* Formatters                                                          */
/* ------------------------------------------------------------------ */

function fmtINR(v: number | null | undefined, decimals = 0): string {
  if (v == null) return '--'
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '--'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%`
}

function fmtPctPlain(v: number | null | undefined): string {
  if (v == null) return '--'
  return v.toFixed(2) + '%'
}

function fmtChange(v: number | null | undefined): string {
  if (v == null) return '--'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${fmtINR(v, 2)}`
}

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
      <div className="portfolio-page__header">
        <h1 className="portfolio-page__title">Portfolio</h1>
        <div className="portfolio-page__header-actions">
          <Button variant="pill" onClick={handleRefreshAll} disabled={isRefreshing}>
            {isRefreshing ? '↻ Refreshing Prices…' : '↻ Refresh Prices'}
          </Button>
          <Button variant="pill" onClick={() => setTxnDialog({ defaultType: 'BUY' })}>+ Add Transaction</Button>
        </div>
      </div>

      {refreshWarning && (
        <div className="portfolio-page__warning-banner">
          <span>Price refresh failed for: {refreshWarning.failedAssets.map(a => a.name).join(', ')}</span>
          <button className="portfolio-page__warning-dismiss" onClick={() => setRefreshWarning(null)}>✕</button>
        </div>
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
            <div className="portfolio-page__empty">
              <p className="portfolio-page__empty-title">No transactions yet</p>
              <p className="portfolio-page__empty-subtitle">Add your first transaction to start tracking your portfolio.</p>
              <Button variant="pill" onClick={() => setTxnDialog({ defaultType: 'BUY' })}>+ Add Transaction</Button>
            </div>
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
              <div className="portfolio-page__tabs">
                {visibleTabs.map(tab => (
                  <button
                    key={tab}
                    className={`portfolio-page__tab${activeTab === tab ? ' portfolio-page__tab--active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {TAB_LABELS[tab]}
                  </button>
                ))}
              </div>

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
            </div>
          )}

          {/* ── Delete confirmation ── */}
          {deletingAssetId != null && (() => {
            const asset = assets.find(a => a.id === deletingAssetId)
            return (
              <div className="portfolio-page__confirm-overlay">
                <div className="portfolio-page__confirm-dialog">
                  <p className="portfolio-page__confirm-title">Remove fund?</p>
                  <p className="portfolio-page__confirm-body">
                    "{asset?.name}" will be removed from your portfolio. This cannot be undone.
                  </p>
                  <div className="portfolio-page__confirm-actions">
                    <button className="portfolio-page__confirm-btn portfolio-page__confirm-btn--cancel" onClick={() => setDeletingAssetId(null)}>Cancel</button>
                    <button className="portfolio-page__confirm-btn portfolio-page__confirm-btn--danger" onClick={() => handleDeleteAsset(deletingAssetId)}>Remove</button>
                  </div>
                </div>
              </div>
            )
          })()}
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
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Summary bar                                                         */
/* ------------------------------------------------------------------ */

function SummaryBar({ summary }: { summary: PortfolioSummaryAnalytics }) {
  const plColor = summary.totalUnrealizedPl >= 0 ? 'var(--color-positive, #16a34a)' : 'var(--color-error)'
  const dayColor = (summary.dayGainLoss ?? 0) >= 0 ? 'var(--color-positive, #16a34a)' : 'var(--color-error)'

  return (
    <div className="portfolio-summary-bar">
      <SummaryTile label="Total Value" value={fmtINR(summary.totalCurrentValue, 0)} />
      <SummaryTile
        label="Day Gain/Loss"
        value={`${fmtChange(summary.dayGainLoss)} (${fmtPct(summary.dayGainLossPct)})`}
        color={dayColor}
      />
      <SummaryTile
        label="Total Return"
        value={`${fmtChange(summary.totalPl)} (${fmtPct(summary.totalUnrealizedPlPct)})`}
        color={plColor}
      />
      <SummaryTile label="XIRR" value={fmtPctPlain(summary.xirr != null ? summary.xirr * 100 : null)} />
    </div>
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

  const accent   = readVar('--color-accent', '#d6fe51')
  const positive = readVar('--color-positive', '#4ebe96')
  const negative = readVar('--color-negative', '#ffa16c')
  const blue     = readVar('--color-cosmic-blue', '#479ffa')
  const textSec  = readVar('--color-text-secondary', '#868f97')
  const bgInput  = readVar('--color-bg-input', '#191919')
  const border   = readVar('--color-border', '#2a2a2a')
  const textPri  = readVar('--color-text-primary', '#e6e6e6')

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {d}%',
      backgroundColor: bgInput,
      borderColor: border,
      textStyle: { color: textPri },
    },
    legend: { orient: 'vertical', right: 10, top: 'middle', textStyle: { fontSize: 12, color: textSec } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['40%', '50%'],
      data,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold' } },
    }],
    color: [accent, blue, positive, negative],
  }

  return (
    <div className="portfolio-chart-card">
      <p className="portfolio-chart-card__title">Allocation by Category</p>
      <ReactECharts option={option} style={{ height: 180 }} />
    </div>
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

  const accent  = readVar('--color-accent', '#d6fe51')
  const textSec = readVar('--color-text-secondary', '#868f97')
  const grid    = readVar('--color-border-subtle', 'rgba(255,255,255,0.06)')
  const bgInput = readVar('--color-bg-input', '#191919')
  const border  = readVar('--color-border', '#2a2a2a')
  const textPri = readVar('--color-text-primary', '#e6e6e6')

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (p: any) => `${p[0].name}: ₹${p[0].value.toLocaleString('en-IN')}`,
      backgroundColor: bgInput,
      borderColor: border,
      textStyle: { color: textPri },
    },
    xAxis: { type: 'category', data: months, axisLabel: { fontSize: 11, color: textSec }, axisLine: { lineStyle: { color: grid } } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`, fontSize: 11, color: textSec }, splitLine: { lineStyle: { color: grid } } },
    series: [{ type: 'bar', data: amounts, itemStyle: { color: accent, borderRadius: [3, 3, 0, 0] } }],
    grid: { left: 50, right: 10, top: 20, bottom: 35 },
  }

  return (
    <div className="portfolio-chart-card">
      <p className="portfolio-chart-card__title">Invested per Month</p>
      <ReactECharts option={option} style={{ height: 180 }} />
    </div>
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
      <div className="portfolio-chart-card portfolio-chart-card--full">
        <div className="portfolio-chart-card__header">
          <p className="portfolio-chart-card__title">Portfolio Value</p>
          <div className="portfolio-chart-card__range-btns">
            {RANGES.map(r => (
              <button key={r} className={`portfolio-range-btn${range === r ? ' portfolio-range-btn--active' : ''}`} onClick={() => onRangeChange(r)}>{r}</button>
            ))}
          </div>
        </div>
        <p className="portfolio-chart-card__empty">Start tracking your portfolio by adding a fund and its first transaction.</p>
      </div>
    )
  }

  const dates    = data.map(d => d.date)
  const invested = data.map(d => Math.round(d.invested))
  const values   = data.map(d => Math.round(d.currentValue))

  const accent  = readVar('--color-accent', '#d6fe51')
  const textSec = readVar('--color-text-secondary', '#868f97')
  const grid    = readVar('--color-border-subtle', 'rgba(255,255,255,0.06)')
  const bgInput = readVar('--color-bg-input', '#191919')
  const border  = readVar('--color-border', '#2a2a2a')
  const textPri = readVar('--color-text-primary', '#e6e6e6')

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: bgInput,
      borderColor: border,
      textStyle: { color: textPri },
      formatter: (params: any) => {
        const d = params[0].name
        const inv = params.find((p: any) => p.seriesName === 'Invested')?.value ?? 0
        const val = params.find((p: any) => p.seriesName === 'Current Value')?.value ?? 0
        return `${d}<br/>Invested: ₹${inv.toLocaleString('en-IN')}<br/>Current: ₹${val.toLocaleString('en-IN')}`
      },
    },
    legend: { bottom: 0, data: ['Invested', 'Current Value'], textStyle: { color: textSec } },
    xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 11, rotate: 30, color: textSec }, axisLine: { lineStyle: { color: grid } } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`, fontSize: 11, color: textSec }, splitLine: { lineStyle: { color: grid } } },
    series: [
      { name: 'Invested', type: 'line', data: invested, step: 'end', lineStyle: { color: textSec }, itemStyle: { color: textSec }, areaStyle: { color: 'rgba(134,143,151,0.08)' }, symbol: 'none' },
      { name: 'Current Value', type: 'line', data: values, smooth: true, lineStyle: { color: accent }, itemStyle: { color: accent }, areaStyle: { color: `rgba(${readVar('--color-accent-rgb', '214,254,81')},0.08)` }, symbol: 'none' },
    ],
    grid: { left: 60, right: 20, top: 20, bottom: 55 },
  }

  return (
    <div className="portfolio-chart-card portfolio-chart-card--full">
      <div className="portfolio-chart-card__header">
        <p className="portfolio-chart-card__title">Portfolio Value</p>
        <div className="portfolio-chart-card__range-btns">
          {RANGES.map(r => (
            <button key={r} className={`portfolio-range-btn${range === r ? ' portfolio-range-btn--active' : ''}`} onClick={() => onRangeChange(r)}>{r}</button>
          ))}
        </div>
      </div>
      <ReactECharts option={option} style={{ height: 220 }} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Fund row                                                            */
/* ------------------------------------------------------------------ */

interface FundRowProps {
  analytics: AssetAnalytics | null
  rawAsset: PortfolioAsset
  onRowClick: () => void
  onBuy: () => void
  onSell: () => void
  onDelete: () => void
}

function FundRow({ analytics: a, rawAsset, onRowClick, onBuy, onSell, onDelete }: FundRowProps) {
  const plColor = (a?.unrealizedPl ?? 0) >= 0 ? 'var(--color-positive, #16a34a)' : 'var(--color-error)'
  const dayColor = (a?.dayGainLoss ?? 0) >= 0 ? 'var(--color-positive, #16a34a)' : 'var(--color-error)'
  const staleness = getStalenessLabel(rawAsset)

  return (
    <tr className="portfolio-page__row portfolio-page__row--clickable" onClick={onRowClick}>
      <td className="portfolio-page__cell-name">
        <span className="portfolio-page__fund-name">{rawAsset.name}</span>
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
      <td className="portfolio-page__col-right">{a ? fmtINR(a.totalInvested) : '—'}</td>
      <td className="portfolio-page__col-right">
        {a ? (
          <>
            <div>{fmtINR(a.currentValue)}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>{a.totalUnits.toFixed(3)} units</div>
          </>
        ) : '—'}
      </td>
      <td className="portfolio-page__col-right" style={{ color: a ? plColor : undefined }}>
        {a ? (
          <>
            <div>{fmtChange(a.unrealizedPl)}</div>
            <div style={{ fontSize: '0.72rem' }}>{fmtPct(a.unrealizedPlPct)}</div>
          </>
        ) : '—'}
      </td>
      <td className="portfolio-page__col-right">{a ? fmtPctPlain(a.xirr != null ? a.xirr * 100 : null) : '—'}</td>
      <td className="portfolio-page__col-right" style={{ color: a ? dayColor : undefined }}>{a ? fmtChange(a.dayGainLoss) : '—'}</td>
      <td className="portfolio-page__col-actions" onClick={e => e.stopPropagation()}>
        <div className="portfolio-page__action-group">
          <button className="portfolio-page__action-btn" onClick={onBuy}>Buy More</button>
          <button className="portfolio-page__action-btn portfolio-page__action-btn--sell" onClick={onSell}>Sell</button>
          <button className="portfolio-page__action-btn portfolio-page__action-btn--delete" onClick={onDelete} aria-label="Delete asset">🗑</button>
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
  const plColor       = totalPl >= 0 ? 'var(--color-positive, #16a34a)' : 'var(--color-error)'

  return (
    <tr className="portfolio-page__subtotal-row">
      <td><span className="portfolio-page__subtotal-label">Subtotal</span></td>
      <td className="portfolio-page__col-right">{fmtINR(totalInvested)}</td>
      <td className="portfolio-page__col-right">{fmtINR(totalCurrent)}</td>
      <td className="portfolio-page__col-right" style={{ color: plColor }}>{fmtChange(totalPl)}</td>
      <td className="portfolio-page__col-right"></td>
      <td className="portfolio-page__col-right"></td>
      <td></td>
    </tr>
  )
}
