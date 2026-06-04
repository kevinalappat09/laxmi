import { useState, useRef, useEffect } from 'react'
import type { AssetCategory, AssetSubCategory } from '../../../../src/types/portfolioAsset'
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
}

export function AssetDialog({ onClose, onSaved }: AssetDialogProps) {
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
