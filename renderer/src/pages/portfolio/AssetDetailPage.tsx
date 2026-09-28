import { useEffect, useState, useCallback } from 'react'
import type { AssetAnalytics } from '../../../../src/types/portfolioAnalytics'
import type { PortfolioAsset } from '../../../../src/types/portfolioAsset'
import type { PortfolioTransaction } from '../../../../src/types/portfolioTransaction'
import { Button } from '../../components/ui/Button'
import { AssetDialog } from './AssetDialog'
import { TransactionDialog } from './TransactionDialog'
import { useNavigation } from '../../contexts/NavigationContext'
import { formatCurrency, formatSignedCurrency, formatSignedPercent } from '../../utils/formatters'
import './AssetDetailPage.css'

const SUB_CATEGORY_LABELS: Record<string, string> = {
  large_cap: 'Large Cap',
  mid_cap: 'Mid Cap',
  small_cap: 'Small Cap',
  flexi_cap: 'Flexi Cap',
  index: 'Index',
  elss: 'ELSS',
  liquid: 'Liquid',
  debt: 'Debt',
  hybrid: 'Hybrid',
  international: 'International',
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
  const [txnDialog, setTxnDialog] = useState<{
    defaultType: 'BUY' | 'SELL'
    transaction?: PortfolioTransaction
  } | null>(null)
  const [editing, setEditing] = useState(false)

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
        <Button variant="square" className="asset-detail__back-btn" onClick={goBackToPortfolio}>← Portfolio</Button>
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
        <Button variant="square" className="asset-detail__back-btn" onClick={goBackToPortfolio}>← Portfolio</Button>
        <h1 className="asset-detail__title">{analytics?.name ?? rawAsset.name}</h1>
      </div>

      <div className="asset-detail__section">
        <div className="asset-detail__section-header">
          <h2 className="asset-detail__section-title">Fund details</h2>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit</Button>
        </div>
        <dl className="asset-detail__details">
          <div className="asset-detail__detail">
            <dt>Name</dt>
            <dd>{rawAsset.name}</dd>
          </div>
          <div className="asset-detail__detail">
            <dt>Category</dt>
            <dd>{rawAsset.category === 'DEBT' ? 'Debt' : 'Equity'}</dd>
          </div>
          <div className="asset-detail__detail">
            <dt>Sub-category</dt>
            <dd>{rawAsset.subCategory ? (SUB_CATEGORY_LABELS[rawAsset.subCategory] ?? rawAsset.subCategory) : 'None'}</dd>
          </div>
          <div className="asset-detail__detail">
            <dt>Scheme</dt>
            <dd>
              {String(rawAsset.metadata?.schemeName ?? rawAsset.name)}
              {rawAsset.priceSourceId && (
                <span className="asset-detail__scheme-code">{rawAsset.priceSourceId}</span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      {/* Metrics grid — only shown once there are holdings */}
      {analytics && (
        <div className="asset-detail__metrics">
          <MetricTile label="Current NAV" value={formatCurrency(analytics.currentNav)} />
          <MetricTile
            label="Day Gain/Loss"
            value={`${formatSignedCurrency(analytics.dayGainLoss)} (${formatSignedPercent(analytics.dayGainLossPct)})`}
            color={dayColor}
          />
          <MetricTile label="Units" value={analytics.totalUnits.toFixed(3)} />
          <MetricTile label="AVCO" value={`${formatCurrency(analytics.avco)}/unit`} />
          <MetricTile label="Invested" value={formatCurrency(analytics.totalInvested, 0)} />
          <MetricTile label="Current Value" value={formatCurrency(analytics.currentValue, 0)} />
          <MetricTile
            label="Unrealized P&L"
            value={`${formatSignedCurrency(analytics.unrealizedPl)} (${formatSignedPercent(analytics.unrealizedPlPct)})`}
            color={plColor}
          />
          <MetricTile label="Realized P&L" value={formatCurrency(analytics.realizedPl)} />
          <MetricTile label="XIRR" value={formatSignedPercent(analytics.xirr != null ? analytics.xirr * 100 : null)} />
          <MetricTile label="CAGR" value={formatSignedPercent(analytics.cagr != null ? analytics.cagr * 100 : null)} />
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
                <th></th>
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
                  <td className="asset-detail__col-right">{formatCurrency(t.pricePerUnit)}</td>
                  <td className="asset-detail__col-right">{t.quantity.toFixed(3)}</td>
                  <td className="asset-detail__col-right">{formatCurrency(t.quantity * t.pricePerUnit, 0)}</td>
                  <td className="asset-detail__txn-note">{t.note ?? ''}</td>
                  <td className="asset-detail__txn-actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setTxnDialog({
                        defaultType: t.transactionType === 'SELL' || t.transactionType === 'REDEMPTION' ? 'SELL' : 'BUY',
                        transaction: t,
                      })}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {txnDialog && rawAsset && (
        <TransactionDialog
          key={txnDialog.transaction?.id ?? `new-${txnDialog.defaultType}`}
          asset={rawAsset}
          transaction={txnDialog.transaction}
          defaultType={txnDialog.defaultType}
          onClose={() => setTxnDialog(null)}
          onSaved={() => { setTxnDialog(null); loadData() }}
        />
      )}

      {editing && rawAsset && (
        <AssetDialog
          asset={rawAsset}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); loadData() }}
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

