import { useState, useRef, useEffect } from 'react'
import type { AssetCategory, AssetSubCategory, PortfolioAsset } from '../../../../src/types/portfolioAsset'
import type { MfSearchResult } from '../../../../src/types/portfolioAnalytics'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import './AssetDialog.css'

const SUB_CATEGORIES: { label: string; value: AssetSubCategory | '' }[] = [
  { label: '(none)',         value: '' },
  { label: 'Large Cap',      value: 'large_cap' },
  { label: 'Mid Cap',        value: 'mid_cap' },
  { label: 'Small Cap',      value: 'small_cap' },
  { label: 'Flexi Cap',      value: 'flexi_cap' },
  { label: 'Index',          value: 'index' },
  { label: 'ELSS',           value: 'elss' },
  { label: 'Liquid',         value: 'liquid' },
  { label: 'Debt',           value: 'debt' },
  { label: 'Hybrid',         value: 'hybrid' },
  { label: 'International',  value: 'international' },
]

interface AssetDialogProps {
  onClose: () => void
  onSaved: () => void
  /** When set, the dialog edits this fund instead of adding a new one. */
  asset?: PortfolioAsset
}

export function AssetDialog({ onClose, onSaved, asset }: AssetDialogProps) {
  if (asset) {
    return <AssetEditDialog asset={asset} onClose={onClose} onSaved={onSaved} />
  }
  return <AssetCreateDialog onClose={onClose} onSaved={onSaved} />
}

function AssetCreateDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MfSearchResult[]>([])
  const [selected, setSelected] = useState<MfSearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Step 2
  const [category, setCategory] = useState<AssetCategory>('EQUITY')
  const [subCategory, setSubCategory] = useState<AssetSubCategory | ''>('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      setSearchError(null)
      try {
        const res = await window.financeAPI.portfolio.mfapi.search(query)
        setResults(res.slice(0, 20))
      } catch {
        setSearchError('Search failed. Check your connection.')
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 400)
  }, [query])

  const handleNext = () => {
    if (!selected) return
    setStep(2)
  }

  const handleConfirm = async () => {
    if (!selected) return
    setSaveError(null)
    setSaving(true)
    try {
      await window.financeAPI.portfolio.asset.create({
        name: selected.schemeName,
        category,
        type: category === 'DEBT' ? 'LIQUID_FUND' : 'EQUITY_MUTUAL_FUND',
        subCategory: subCategory || null,
        priceSource: 'MFAPI',
        priceSourceId: selected.schemeCode,
        metadata: {
          schemeCode: selected.schemeCode,
          schemeName: selected.schemeName,
        },
      })
      onSaved()
    } catch (err: any) {
      console.error(err)
      setSaveError(err?.message ?? 'Failed to add fund.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      isOpen
      className="asset-dialog"
      panelClassName="asset-dialog__panel"
      bodyClassName="asset-dialog__body"
      title="Add Fund"
      onClose={onClose}
    >
      {step === 1 && (
        <div className="asset-dialog__step">
          <Input
            id="mfSearch"
            label="Search"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(null)
            }}
            placeholder="e.g. Parag Parikh, HDFC Top 100"
            autoFocus
          />

          {isSearching && <p className="asset-dialog__hint">Searching…</p>}
          {searchError && <p className="asset-dialog__error">{searchError}</p>}

          {results.length > 0 && (
            <ul className="asset-dialog__results">
              {results.map((r) => (
                <li
                  key={r.schemeCode}
                  className={`asset-dialog__result-item${selected?.schemeCode === r.schemeCode ? ' asset-dialog__result-item--selected' : ''}`}
                  onClick={() => setSelected(r)}
                >
                  {r.schemeName}
                </li>
              ))}
            </ul>
          )}

          <div className="asset-dialog__actions">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="button" variant="pill" onClick={handleNext} disabled={!selected}>
              Next →
            </Button>
          </div>
        </div>
      )}

      {step === 2 && selected && (
        <div className="asset-dialog__step">
          <div className="asset-dialog__confirm-field">
            <span className="asset-dialog__confirm-label">Name</span>
            <span className="asset-dialog__confirm-value">{selected.schemeName}</span>
          </div>

          <div className="asset-dialog__confirm-field">
            <span className="asset-dialog__confirm-label">Category</span>
            <div className="asset-dialog__category-strip">
              {(['EQUITY', 'DEBT'] as AssetCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`asset-dialog__cat-btn${category === cat ? ' asset-dialog__cat-btn--active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="asset-dialog__confirm-field">
            <span className="asset-dialog__confirm-label">Sub-category</span>
            <select
              className="asset-dialog__select"
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value as AssetSubCategory | '')}
            >
              {SUB_CATEGORIES.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {saveError && <p className="asset-dialog__error">{saveError}</p>}

          <div className="asset-dialog__actions">
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>← Back</Button>
            <Button type="button" variant="pill" onClick={handleConfirm} disabled={saving}>
              {saving ? 'Adding…' : 'Add Fund'}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}

function AssetEditDialog({
  asset,
  onClose,
  onSaved,
}: {
  asset: PortfolioAsset
  onClose: () => void
  onSaved: () => void
}) {
  const isMutualFund = asset.type === 'EQUITY_MUTUAL_FUND' || asset.type === 'LIQUID_FUND'
  const initialSchemeCode = asset.priceSourceId ?? String(asset.metadata?.schemeCode ?? '')
  const initialSchemeName = String(asset.metadata?.schemeName ?? asset.name)

  const [name, setName] = useState(asset.name)
  const [category, setCategory] = useState<AssetCategory>(asset.category)
  const [subCategory, setSubCategory] = useState<AssetSubCategory | ''>(asset.subCategory ?? '')
  const [schemeCode, setSchemeCode] = useState(initialSchemeCode)
  const [schemeName, setSchemeName] = useState(initialSchemeName)
  const [changingScheme, setChangingScheme] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MfSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!changingScheme) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      setSearchError(null)
      try {
        const res = await window.financeAPI.portfolio.mfapi.search(query)
        setResults(res.slice(0, 20))
      } catch {
        setSearchError('Search failed. Check your connection.')
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, changingScheme])

  const handlePickScheme = (result: MfSearchResult) => {
    setSchemeCode(result.schemeCode)
    setSchemeName(result.schemeName)
    setName(result.schemeName)
    setChangingScheme(false)
    setQuery('')
    setResults([])
  }

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setSaveError('Name is required.')
      return
    }
    setSaveError(null)
    setSaving(true)
    try {
      const schemeChanged = schemeCode !== initialSchemeCode
      await window.financeAPI.portfolio.asset.update(asset.id, {
        name: trimmed,
        subCategory: subCategory || null,
        ...(isMutualFund
          ? {
              category,
              type: category === 'DEBT' ? 'LIQUID_FUND' as const : 'EQUITY_MUTUAL_FUND' as const,
            }
          : {}),
        ...(schemeChanged
          ? {
              priceSource: 'MFAPI' as const,
              priceSourceId: schemeCode,
              metadata: {
                ...(asset.metadata ?? {}),
                schemeCode,
                schemeName,
              },
            }
          : {}),
      })
      onSaved()
    } catch (err: unknown) {
      console.error(err)
      setSaveError(err instanceof Error ? err.message : 'Failed to save fund.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      isOpen
      className="asset-dialog"
      panelClassName="asset-dialog__panel"
      bodyClassName="asset-dialog__body"
      title="Edit Fund"
      onClose={onClose}
    >
      {changingScheme ? (
        <div className="asset-dialog__step">
          <Input
            id="mfEditSearch"
            label="Search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Parag Parikh, HDFC Top 100"
            autoFocus
          />

          {isSearching && <p className="asset-dialog__hint">Searching…</p>}
          {searchError && <p className="asset-dialog__error">{searchError}</p>}

          {results.length > 0 && (
            <ul className="asset-dialog__results">
              {results.map((r) => (
                <li
                  key={r.schemeCode}
                  className="asset-dialog__result-item"
                  onClick={() => handlePickScheme(r)}
                >
                  {r.schemeName}
                </li>
              ))}
            </ul>
          )}

          <div className="asset-dialog__actions">
            <Button type="button" variant="secondary" onClick={() => setChangingScheme(false)}>← Back</Button>
          </div>
        </div>
      ) : (
        <div className="asset-dialog__step">
          <Input
            id="assetName"
            label="Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          {isMutualFund && (
            <div className="asset-dialog__confirm-field">
              <span className="asset-dialog__confirm-label">Category</span>
              <div className="asset-dialog__category-strip">
                {(['EQUITY', 'DEBT'] as AssetCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`asset-dialog__cat-btn${category === cat ? ' asset-dialog__cat-btn--active' : ''}`}
                    onClick={() => setCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="asset-dialog__confirm-field">
            <span className="asset-dialog__confirm-label">Sub-category</span>
            <select
              className="asset-dialog__select"
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value as AssetSubCategory | '')}
            >
              {SUB_CATEGORIES.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {isMutualFund && (
            <div className="asset-dialog__confirm-field">
              <span className="asset-dialog__confirm-label">Linked scheme</span>
              <div className="asset-dialog__scheme-row">
                <div>
                  <div className="asset-dialog__confirm-value">{schemeName}</div>
                  {schemeCode && <div className="asset-dialog__scheme-code">{schemeCode}</div>}
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => setChangingScheme(true)}>
                  Change
                </Button>
              </div>
              <p className="asset-dialog__hint">The next price refresh uses this scheme. Existing transactions stay on this fund.</p>
            </div>
          )}

          {saveError && <p className="asset-dialog__error">{saveError}</p>}

          <div className="asset-dialog__actions">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="button" variant="pill" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
