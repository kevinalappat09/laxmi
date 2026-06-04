import { useEffect, useState, useCallback } from 'react'
import type { AssetAnalytics } from '../../../../src/types/portfolioAnalytics'
import type { PortfolioAsset } from '../../../../src/types/portfolioAsset'
import type { PortfolioTransaction } from '../../../../src/types/portfolioTransaction'
import { Button } from '../../components/ui/Button'
import { TransactionDialog } from './TransactionDialog'
import { useNavigation } from '../../contexts/NavigationContext'
import './AssetDetailPage.css'

/* ------------------------------------------------------------------ */
/* Formatters                                                          */
/* ------------------------------------------------------------------ */

function fmtINR(v: number | null | undefined, decimals = 2): string {
  if (v == null) return '--'
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '--'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%`
}

function fmtChange(v: number | null | undefined): string {
  if (v == null) return '--'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${fmtINR(v)}`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface AssetDetailPageProps {
  assetId: number
}

export function AssetDetailPage({ assetId }: AssetDetailPageProps) {
  const { goBackToPortfolio } = useNavigation()

  const [analytics, setAnalytics] = useState<AssetAnalytics | null>(null)
  const [rawAsset, setRawAsset] = useState<PortfolioAsset | null>(null)
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [txnDialog, setTxnDialog] = useState<{ defaultType: 'BUY' | 'SELL' } | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [assetData, txns] = await Promise.all([
        window.financeAPI.portfolio.asset.get(assetId),
        window.financeAPI.portfolio.transaction.listByAsset(assetId),
      ])
      setRawAsset(assetData)
      setTransactions(txns)
      // Analytics only available once the asset has transactions
      try {
        const analyticsData = await window.financeAPI.portfolio.analytics.asset(assetId)
        setAnalytics(analyticsData)
      } catch {
        setAnalytics(null)
      }
    } catch (err) {
      console.error(err)
      setError('Failed to load asset details.')
    } finally {
      setIsLoading(false)
    }
  }, [assetId])

  useEffect(() => { loadData() }, [loadData])

  if (isLoading) {
    return <div className="asset-detail-page"><p className="asset-detail__loading">Loading…</p></div>
  }

  if (error || !rawAsset) {
    return (
      <div className="asset-detail-page">
        <button className="asset-detail__back-btn" onClick={goBackToPortfolio}>← Portfolio</button>
        <p className="asset-detail__error">{error ?? 'Asset not found.'}</p>
      </div>
    )
  }

  const plColor   = (analytics?.unrealizedPl ?? 0) >= 0 ? 'var(--color-positive, #16a34a)' : 'var(--color-error)'
  const dayColor  = (analytics?.dayGainLoss ?? 0) >= 0 ? 'var(--color-positive, #16a34a)' : 'var(--color-error)'

  return (
    <div className="asset-detail-page">
      {/* Header */}
      <div className="asset-detail__header">
        <button className="asset-detail__back-btn" onClick={goBackToPortfolio}>← Portfolio</button>
        <h1 className="asset-detail__title">{analytics?.name ?? rawAsset.name}</h1>
      </div>

      {/* Metrics grid — only shown once there are holdings */}
      {analytics && (
        <div className="asset-detail__metrics">
          <MetricTile label="Current NAV" value={fmtINR(analytics.currentNav)} />
          <MetricTile
            label="Day Gain/Loss"
            value={`${fmtChange(analytics.dayGainLoss)} (${fmtPct(analytics.dayGainLossPct)})`}
            color={dayColor}
          />
          <MetricTile label="Units" value={analytics.totalUnits.toFixed(3)} />
          <MetricTile label="AVCO" value={`${fmtINR(analytics.avco)}/unit`} />
          <MetricTile label="Invested" value={fmtINR(analytics.totalInvested, 0)} />
          <MetricTile label="Current Value" value={fmtINR(analytics.currentValue, 0)} />
          <MetricTile
            label="Unrealized P&L"
            value={`${fmtChange(analytics.unrealizedPl)} (${fmtPct(analytics.unrealizedPlPct)})`}
            color={plColor}
          />
          <MetricTile label="Realized P&L" value={fmtINR(analytics.realizedPl)} />
          <MetricTile label="XIRR" value={analytics.xirr != null ? fmtPct(analytics.xirr * 100) : '--'} />
          <MetricTile label="CAGR" value={analytics.cagr != null ? fmtPct(analytics.cagr * 100) : '--'} />
        </div>
      )}

      {/* Transactions */}
      <div className="asset-detail__section">
        <div className="asset-detail__section-header">
          <h2 className="asset-detail__section-title">Transactions</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="pill" onClick={() => setTxnDialog({ defaultType: 'BUY' })}>+ Buy</Button>
            <Button variant="pill" onClick={() => setTxnDialog({ defaultType: 'SELL' })}>+ Sell</Button>
          </div>
        </div>

        {transactions.length === 0 ? (
          <p className="asset-detail__empty">No transactions yet.</p>
        ) : (
          <table className="asset-detail__txn-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th className="asset-detail__col-right">Price/unit</th>
                <th className="asset-detail__col-right">Units</th>
                <th className="asset-detail__col-right">Amount</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} className="asset-detail__txn-row">
                  <td>{fmtDate(t.transactionDate)}</td>
                  <td>
                    <span className={`asset-detail__txn-badge asset-detail__txn-badge--${t.transactionType.toLowerCase()}`}>
                      {t.transactionType}
                    </span>
                  </td>
                  <td className="asset-detail__col-right">{fmtINR(t.pricePerUnit)}</td>
                  <td className="asset-detail__col-right">{t.quantity.toFixed(3)}</td>
                  <td className="asset-detail__col-right">{fmtINR(t.quantity * t.pricePerUnit, 0)}</td>
                  <td className="asset-detail__txn-note">{t.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {txnDialog && rawAsset && (
        <TransactionDialog
          asset={rawAsset}
          defaultType={txnDialog.defaultType}
          onClose={() => setTxnDialog(null)}
          onSaved={() => { setTxnDialog(null); loadData() }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Metric tile                                                         */
/* ------------------------------------------------------------------ */

function MetricTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="asset-detail__metric-tile">
      <span className="asset-detail__metric-label">{label}</span>
      <span className="asset-detail__metric-value" style={color ? { color } : undefined}>{value}</span>
    </div>
  )
}

