import { useEffect, useState } from 'react'
import type { Account } from '../../../../src/types/account'
import type { CSVExportRequest } from '../../../../src/types/csvImport'
import { CSVImportDialog } from './CSVImportDialog'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Select } from '../../components/ui/Input'
import './ImportExportPage.css'

export function ImportExportPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)

  const [showImportDialog, setShowImportDialog] = useState(false)

  const [exportAccountId, setExportAccountId] = useState('')
  const [exportPositiveAreDeposits, setExportPositiveAreDeposits] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportResult, setExportResult] = useState<{ savedPath?: string; error?: string } | null>(null)

  useEffect(() => {
    window.financeAPI.listActiveAccounts().then((list) => {
      setAccounts(list)
      if (list.length > 0) setExportAccountId(String(list[0].account_id))
      setIsLoadingAccounts(false)
    })
  }, [])

  const handleExport = async () => {
    if (!exportAccountId) return
    setIsExporting(true)
    setExportResult(null)
    try {
      const request: CSVExportRequest = {
        accountId: Number(exportAccountId),
        positiveAreDeposits: exportPositiveAreDeposits,
      }
      const result = await window.financeAPI.csvExportTransactions(request)
      if (result.cancelled) {
        setExportResult(null)
      } else {
        setExportResult({ savedPath: result.savedPath })
      }
    } catch {
      setExportResult({ error: 'Export failed. Please try again.' })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="import-export-page">
      <div className="import-export-page__header">
        <h1>Import / Export</h1>
      </div>

      <div className="import-export-page__cards">
        {/* Import card */}
        <Card className="import-export-card" padding="none">
          <div className="import-export-card__icon">⬇</div>
          <h2 className="import-export-card__title">Import from CSV</h2>
          <p className="import-export-card__desc">
            Load transactions from a CSV file into an account. Preview rows before committing,
            and export any errors for easy correction.
          </p>
          <Button className="import-export-card__btn import-export-card__btn--primary" variant="pill" onClick={() => setShowImportDialog(true)}>
            Import Transactions
          </Button>
        </Card>

        {/* Export card */}
        <Card className="import-export-card" padding="none">
          <div className="import-export-card__icon">⬆</div>
          <h2 className="import-export-card__title">Export to CSV</h2>
          <p className="import-export-card__desc">
            Save all transactions from an account to a CSV file. Choose how positive amounts are
            interpreted for your bank's format.
          </p>

          <div className="import-export-card__form">
            <Select
              id="export-account"
              label="Account"
              className="import-export-card__field"
              value={exportAccountId}
              onChange={(e) => setExportAccountId(e.target.value)}
              disabled={isLoadingAccounts || accounts.length === 0}
            >
                {accounts.length === 0 ? (
                  <option value="">No accounts</option>
                ) : (
                  accounts.map((a) => (
                    <option key={a.account_id} value={a.account_id}>
                      {a.account_name}
                    </option>
                  ))
                )}
            </Select>

            <div className="import-export-card__field">
              <label>Amount convention</label>
              <div className="import-export-card__radio-group">
                <label className="import-export-card__radio">
                  <input
                    type="radio"
                    name="export-polarity"
                    checked={exportPositiveAreDeposits}
                    onChange={() => setExportPositiveAreDeposits(true)}
                  />
                  Positives are deposits
                </label>
                <label className="import-export-card__radio">
                  <input
                    type="radio"
                    name="export-polarity"
                    checked={!exportPositiveAreDeposits}
                    onChange={() => setExportPositiveAreDeposits(false)}
                  />
                  Positives are withdrawals
                </label>
              </div>
            </div>
          </div>

          {exportResult?.savedPath && (
            <div className="import-export-card__success">
              Saved to: <span>{exportResult.savedPath}</span>
            </div>
          )}
          {exportResult?.error && (
            <div className="import-export-card__error">{exportResult.error}</div>
          )}

          <Button
            className="import-export-card__btn import-export-card__btn--primary"
            variant="pill"
            onClick={handleExport}
            disabled={isExporting || !exportAccountId}
          >
            {isExporting ? 'Exporting…' : 'Export Transactions'}
          </Button>
        </Card>
      </div>

      {showImportDialog && (
        <CSVImportDialog
          accounts={accounts}
          onClose={() => setShowImportDialog(false)}
        />
      )}
    </div>
  )
}
