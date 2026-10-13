import { useEffect, useRef, useState } from 'react'
import type { Account } from '../../../../src/types/account'
import type { PortfolioAsset, AssetCategory, AssetSubCategory } from '../../../../src/types/portfolioAsset'
import type { MfSearchResult, MfFundMeta } from '../../../../src/types/portfolioAnalytics'
import type { PortfolioTransaction, PortfolioTransactionType } from '../../../../src/types/portfolioTransaction'
import { AccountSubType } from '../../../../src/types/account'
import { Button, Checkbox, Dialog, Input, SegmentedControl, Select } from '../../components/ui'
import './TransactionDialog.css'

const TXN_TYPES: { label: string; value: PortfolioTransactionType }[] = [
  { label: 'Buy',        value: 'BUY' },
  { label: 'SIP',        value: 'SIP' },
  { label: 'Sell',       value: 'SELL' },
  { label: 'Redemption', value: 'REDEMPTION' },
  { label: 'Dividend',   value: 'DIVIDEND' },
]

const SUB_CATEGORIES: { label: string; value: AssetSubCategory | '' }[] = [
  { label: '(none)',        value: '' },
  { label: 'Large Cap',     value: 'large_cap' },
  { label: 'Mid Cap',       value: 'mid_cap' },
  { label: 'Small Cap',     value: 'small_cap' },
  { label: 'Flexi Cap',     value: 'flexi_cap' },
  { label: 'Index',         value: 'index' },
  { label: 'ELSS',          value: 'elss' },
  { label: 'Liquid',        value: 'liquid' },
  { label: 'Debt',          value: 'debt' },
  { label: 'Hybrid',        value: 'hybrid' },
  { label: 'International', value: 'international' },
]

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

interface TransactionDialogProps {
  /** Pre-selected asset — if omitted the dialog shows a fund picker first */
  asset?: PortfolioAsset
  /** When set, the dialog edits this transaction instead of logging a new one. */
  transaction?: PortfolioTransaction
  defaultType?: 'BUY' | 'SELL'
  onClose: () => void
  onSaved: () => void
}

export function TransactionDialog({ asset: preselectedAsset, transaction, defaultType = 'BUY', onClose, onSaved }: TransactionDialogProps) {
  /* ── Fund picker state (only used when no asset is pre-selected) ── */
  const [allAssets, setAllAssets]             = useState<PortfolioAsset[]>([])
  const [fundMode, setFundMode]               = useState<'existing' | 'new'>('existing')
  const [selectedAssetId, setSelectedAssetId] = useState<number | ''>('')

  // New-fund search
  const [mfQuery, setMfQuery]         = useState('')
  const [mfResults, setMfResults]     = useState<MfSearchResult[]>([])
  const [mfSearching, setMfSearching] = useState(false)
  const [mfError, setMfError]         = useState<string | null>(null)
  const [selectedMf, setSelectedMf]   = useState<MfSearchResult | null>(null)
  const [duplicateAsset, setDuplicateAsset] = useState<PortfolioAsset | null>(null)
  const [mfMeta, setMfMeta] = useState<MfFundMeta | null>(null)
  const [newCategory, setNewCategory] = useState<AssetCategory>('EQUITY')
  const [newSubCat, setNewSubCat]     = useState<AssetSubCategory | ''>('')

  const mfDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Transaction state ── */
  const [txnType, setTxnType]       = useState<PortfolioTransactionType>(transaction?.transactionType ?? defaultType)
  const [date, setDate]             = useState(transaction ? transaction.transactionDate.slice(0, 10) : todayISO())
  const [navPrice, setNavPrice]     = useState(transaction ? String(transaction.pricePerUnit) : '')
  const [amount, setAmount]         = useState(transaction ? String(transaction.quantity * transaction.pricePerUnit) : '')
  const [manualUnits, setManualUnits] = useState(transaction != null)
  const [units, setUnits]           = useState(transaction ? String(transaction.quantity) : '')
  const [fees, setFees]             = useState(transaction ? String(transaction.fees) : '0')
  const [note, setNote]             = useState(transaction?.note ?? '')

  const [accounts, setAccounts]                     = useState<Account[]>([])
  const [investmentAccountId, setInvestmentAccountId] = useState<number | ''>(transaction?.assetAccountId ?? '')
  const [sourceAccountId, setSourceAccountId]         = useState<number | ''>(transaction?.sourceAccountId ?? '')

  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [oversellError, setOversellError] = useState<string | null>(null)

  /* ── Load lists on mount ── */
  useEffect(() => {
    window.financeAPI.listActiveAccounts().then(setAccounts).catch(console.error)
    if (!preselectedAsset) {
      window.financeAPI.portfolio.asset.list().then(assets => {
        setAllAssets(assets)
        if (assets.length === 0) setFundMode('new')
      }).catch(console.error)
    }
  }, [preselectedAsset])

  /* ── MF search debounce ── */
  useEffect(() => {
    if (mfDebounceRef.current) clearTimeout(mfDebounceRef.current)
    if (!mfQuery.trim()) { setMfResults([]); return }
    mfDebounceRef.current = setTimeout(async () => {
      setMfSearching(true)
      setMfError(null)
      try {
        const res = await window.financeAPI.portfolio.mfapi.search(mfQuery)
        setMfResults(res.slice(0, 20))
      } catch {
        setMfError('Search failed. Check your connection.')
        setMfResults([])
      } finally {
        setMfSearching(false)
      }
    }, 400)
  }, [mfQuery])

  /* ── Derived values ── */
  const investmentAccounts = accounts.filter(a => a.sub_type === AccountSubType.Investment)
  const fundingAccounts    = accounts.filter(a => a.sub_type !== AccountSubType.Investment && a.sub_type !== 'salary' as any)

  const isBuyLike  = txnType === 'BUY' || txnType === 'SIP'
  const isSellLike = txnType === 'SELL' || txnType === 'REDEMPTION'

  const nav           = parseFloat(navPrice) || 0
  const computedUnits = manualUnits ? (parseFloat(units) || 0) : (nav > 0 ? (parseFloat(amount) || 0) / nav : 0)
  const fundingLabel  = isBuyLike ? 'Funded from' : isSellLike ? 'Proceeds to' : 'Account'

  const dialogTitle = transaction
    ? `Edit Transaction — ${preselectedAsset?.name ?? 'Fund'}`
    : preselectedAsset
      ? `Log Transaction — ${preselectedAsset.name}`
      : 'Add Transaction'

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setOversellError(null)

    // Validate fund selection
    if (!preselectedAsset && !transaction) {
      if (fundMode === 'existing' && selectedAssetId === '') {
        setError('Please select a fund.')
        return
      }
      if (fundMode === 'new' && !selectedMf) {
        setError('Please search for and select a fund.')
        return
      }
    }

    if (!investmentAccountId) { setError('Investment account is required.'); return }
    if (nav <= 0)              { setError('NAV / Price must be greater than 0.'); return }
    if (computedUnits <= 0)    { setError('Units must be greater than 0.'); return }

    setSaving(true)
    try {
      if (transaction) {
        const req: any = {
          transactionType: txnType,
          pricePerUnit: nav,
          fees: parseFloat(fees) || 0,
          taxes: transaction.taxes,
          transactionDate: new Date(date),
          isDividendReinvestment: txnType === 'DIVIDEND' ? transaction.isDividendReinvestment : false,
          assetAccountId: investmentAccountId as number,
          sourceAccountId: sourceAccountId !== '' ? sourceAccountId as number : null,
          note: note.trim() || undefined,
        }
        if (manualUnits) {
          req.quantity = computedUnits
        } else {
          req.investedAmount = parseFloat(amount) || 0
        }
        await window.financeAPI.portfolio.transaction.update(transaction.id, req)
        onSaved()
        return
      }

      let assetId: number

      if (preselectedAsset) {
        assetId = preselectedAsset.id
      } else if (fundMode === 'existing') {
        assetId = selectedAssetId as number
      } else {
        if (duplicateAsset) {
          // Reuse existing fund so duplicate portfolio entries are not created.
          assetId = duplicateAsset.id
        } else {
          const created = await window.financeAPI.portfolio.asset.create({
            name: selectedMf!.schemeName,
            category: newCategory,
            type: newCategory === 'DEBT' ? 'LIQUID_FUND' : 'EQUITY_MUTUAL_FUND',
            subCategory: newSubCat || null,
            priceSource: 'MFAPI',
            priceSourceId: selectedMf!.schemeCode,
            metadata: {
              schemeCode: selectedMf!.schemeCode,
              schemeName: selectedMf!.schemeName,
              schemeType: mfMeta?.schemeType,
              schemeCategory: mfMeta?.schemeCategory,
            },
          })
          assetId = created.id
        }
      }

      const req: any = {
        portfolioAssetId: assetId,
        transactionType: txnType,
        pricePerUnit: nav,
        fees: parseFloat(fees) || 0,
        transactionDate: new Date(date),
        assetAccountId: investmentAccountId as number,
        sourceAccountId: sourceAccountId !== '' ? sourceAccountId as number : null,
        note: note.trim() || undefined,
      }

      if (manualUnits) {
        req.quantity = computedUnits
      } else {
        req.investedAmount = parseFloat(amount) || 0
      }

      await window.financeAPI.portfolio.transaction.create(req)
      onSaved()
    } catch (err: any) {
      console.error(err)
      const msg = err?.message ?? 'Failed to log transaction.'
      if (msg.includes('Cannot sell more units')) {
        setOversellError(msg)
      } else {
        setError(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      className="txn-dialog"
      panelClassName="txn-dialog__panel"
      bodyClassName="txn-dialog__body"
      title={dialogTitle}
      onOpenChange={(open) => { if (!open) onClose() }}
    >
      <form className="txn-dialog__form" onSubmit={handleSubmit}>

        {/* ── Fund picker (only when no pre-selected asset) ── */}
        {!preselectedAsset && (
          <div className="txn-dialog__fund-section">
            <div className="txn-dialog__section-label">Fund</div>

            {allAssets.length > 0 && (
              <SegmentedControl
                className="txn-dialog__fund-mode-strip"
                ariaLabel="Fund source"
                value={fundMode}
                onValueChange={(value) => {
                  setFundMode(value as 'existing' | 'new')
                  setDuplicateAsset(null)
                  setMfMeta(null)
                  if (value === 'new') setSelectedAssetId('')
                }}
                options={[{ value: 'existing', label: 'Existing fund' }, { value: 'new', label: 'Add new fund' }]}
              />
            )}

            {fundMode === 'existing' && allAssets.length > 0 && (
              <Select
                  id="portfolio-existing-fund"
                  label="Fund"
                  className="txn-dialog__field"
                  value={selectedAssetId}
                  onChange={e => setSelectedAssetId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Select fund…</option>
                  {allAssets.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
              </Select>
            )}

            {fundMode === 'new' && (
              <div className="txn-dialog__new-fund">
                <Input
                  id="mfSearch"
                  label="Search fund name"
                  type="text"
                  value={mfQuery}
                  onChange={e => { setMfQuery(e.target.value); setSelectedMf(null); setDuplicateAsset(null); setMfMeta(null) }}
                  placeholder="e.g. Parag Parikh, HDFC Top 100"
                  autoFocus={allAssets.length === 0}
                />

                {mfSearching && <p className="txn-dialog__hint">Searching…</p>}
                {mfError    && <p className="txn-dialog__error">{mfError}</p>}

                {selectedMf && (
                  <div className="txn-dialog__selected-fund">
                    <span className="txn-dialog__selected-fund-name">{selectedMf.schemeName}</span>
                    <Button variant="icon" size="icon" className="txn-dialog__clear-fund" aria-label="Clear selected fund" onClick={() => { setSelectedMf(null); setMfQuery(''); setDuplicateAsset(null); setMfMeta(null) }}>✕</Button>
                  </div>
                )}

                {selectedMf && duplicateAsset && (
                  <p className="txn-dialog__warn">
                    This fund already exists in your portfolio. The transaction will be added to <strong>{duplicateAsset.name}</strong> instead of creating a new entry.
                  </p>
                )}

                {!selectedMf && mfResults.length > 0 && (
                  <ul className="txn-dialog__mf-results">
                    {mfResults.map(r => (
                      <li key={r.schemeCode}>
                        <Button
                          variant="subtle"
                          className="txn-dialog__mf-result-item"
                          onClick={() => {
                          const existing = allAssets.find(a => a.priceSourceId === r.schemeCode)
                          setDuplicateAsset(existing ?? null)
                          setSelectedMf(r)
                          setMfQuery(r.schemeName)
                          setMfResults([])
                          setMfMeta(null)
                          if (!existing) {
                            window.financeAPI.portfolio.mfapi.getMeta(r.schemeCode)
                              .then(meta => {
                                setMfMeta(meta)
                                setNewCategory(meta.category)
                                setNewSubCat(meta.subCategory ?? '')
                              })
                              .catch(() => {
                                // Leave current defaults if metadata fetch fails.
                              })
                          }
                          }}
                        >
                          {r.schemeName}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                {selectedMf && !duplicateAsset && (
                  <div className="txn-dialog__category-row">
                    <div className="txn-dialog__field">
                      <label className="txn-dialog__label">Category</label>
                      <SegmentedControl className="txn-dialog__type-strip" ariaLabel="New fund category" value={newCategory} onValueChange={(value) => setNewCategory(value as AssetCategory)} options={[{ value: 'EQUITY', label: 'EQUITY' }, { value: 'DEBT', label: 'DEBT' }]} />
                    </div>
                    <div className="txn-dialog__field">
                      <Select
                        id="portfolio-new-sub-category"
                        label="Sub-category"
                        value={newSubCat}
                        onChange={e => setNewSubCat(e.target.value as AssetSubCategory | '')}
                      >
                        {SUB_CATEGORIES.map(({ label, value }) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Type selector ── */}
        <div className="txn-dialog__section-label">Transaction</div>
        <SegmentedControl className="txn-dialog__type-strip" ariaLabel="Transaction type" value={txnType} onValueChange={(value) => setTxnType(value as PortfolioTransactionType)} options={TXN_TYPES} />

        <Input
          id="txnDate"
          label="Date"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          required
        />

        {/* ── Amount ── */}
        <div className="txn-dialog__section-label">Amount</div>

        {!manualUnits && (
          <div className="txn-dialog__amount-row">
            <span className="txn-dialog__currency">₹</span>
            <Input
              id="portfolio-amount"
              label="Amount"
              hideLabel
              controlClassName="txn-dialog__input"
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
        )}

        {nav > 0 && !manualUnits && (
          <p className="txn-dialog__unit-hint">
            ≈ {computedUnits.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} units at ₹{nav.toFixed(2)}/unit
          </p>
        )}

        <Checkbox id="portfolio-manual-units" className="txn-dialog__toggle" label="Enter units manually" checked={manualUnits} onCheckedChange={(checked) => setManualUnits(checked === true)} />

        {manualUnits && (
          <Input
            id="portfolio-units"
            label="Units"
            hideLabel
            controlClassName="txn-dialog__input"
            type="number"
            min="0"
            step="any"
            placeholder="Units"
            value={units}
            onChange={e => setUnits(e.target.value)}
          />
        )}

        <Input
          id="navPrice"
          label="NAV / Price (₹)"
          type="number"
          value={navPrice}
          onChange={e => setNavPrice(e.target.value)}
          placeholder="e.g. 40.55"
          required
        />

        <Input
          id="fees"
          label="Fees (₹)"
          type="number"
          value={fees}
          onChange={e => setFees(e.target.value)}
          placeholder="0"
        />

        {/* ── Accounts ── */}
        <div className="txn-dialog__section-label">Accounts</div>

        <Select
            id="investmentAccount"
            label="Investment account *"
            className="txn-dialog__field"
            value={investmentAccountId}
            onChange={e => setInvestmentAccountId(e.target.value ? Number(e.target.value) : '')}
            required
          >
            <option value="">Select investment account…</option>
            {investmentAccounts.map(a => (
              <option key={a.account_id} value={a.account_id}>
                {a.metadata?.brokerage ? String(a.metadata.brokerage) : a.institution_name}
              </option>
            ))}
        </Select>

        <Select
            id="sourceAccount"
            label={fundingLabel}
            className="txn-dialog__field"
            value={sourceAccountId}
            onChange={e => setSourceAccountId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">None</option>
            {fundingAccounts.map(a => (
              <option key={a.account_id} value={a.account_id}>
                {a.institution_name} — {a.account_name}
              </option>
            ))}
        </Select>

        <Input
          id="note"
          label="Note"
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optional"
        />

        {oversellError && <p className="txn-dialog__error txn-dialog__error--oversell">{oversellError}</p>}
        {error         && <p className="txn-dialog__error">{error}</p>}

        <div className="txn-dialog__actions">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="pill" disabled={saving || !!oversellError}>
            {saving ? 'Saving…' : transaction ? 'Save' : 'Log Transaction'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
