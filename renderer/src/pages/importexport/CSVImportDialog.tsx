import { useState } from 'react'
import type { Account } from '../../../../src/types/account'
import type {
  CSVPreviewResult,
  CSVImportResult,
  CSVTransactionRow,
} from '../../../../src/types/csvImport'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Select } from '../../components/ui/Input'
import './CSVImportDialog.css'

type DialogState = 'idle' | 'previewing' | 'result'

interface CSVImportDialogProps {
  accounts: Account[]
  onClose: () => void
}

export function CSVImportDialog({ accounts, onClose }: CSVImportDialogProps) {
  const [state, setState] = useState<DialogState>('idle')

  const [accountId, setAccountId] = useState(
    accounts.length > 0 ? String(accounts[0].account_id) : ''
  )
  const [dateFormat] = useState('DD-MM-YYYY')
  const [positiveAreDeposits, setPositiveAreDeposits] = useState(true)

  const [preview, setPreview] = useState<CSVPreviewResult | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isLoadingFile, setIsLoadingFile] = useState(false)

  const [importResult, setImportResult] = useState<CSVImportResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const [templateMessage, setTemplateMessage] = useState<string | null>(null)
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false)

  const [isExportingErrors, setIsExportingErrors] = useState(false)

  const handleSelectFile = async () => {
    setFileError(null)
    setIsLoadingFile(true)
    try {
      const result = await window.financeAPI.csvOpenAndPreview()
      if (result.cancelled) {
        setIsLoadingFile(false)
        return
      }
      if (result.error) {
        const messages: Record<string, string> = {
          FILE_TOO_LARGE: 'The selected file is too large to import.',
          TOO_MANY_ROWS: 'The file contains too many rows.',
          FILE_READ_ERROR: 'Could not read the file. Please try again.',
        }
        setFileError(messages[result.error] ?? 'Unknown error reading file.')
        setIsLoadingFile(false)
        return
      }
      setPreview(result)
      setState('previewing')
    } catch {
      setFileError('Failed to open file. Please try again.')
    } finally {
      setIsLoadingFile(false)
    }
  }

  const handleImport = async () => {
    if (!accountId || !preview) return
    setImportError(null)
    setIsImporting(true)
    try {
      const result = await window.financeAPI.csvImportConfirm({
        accountId: Number(accountId),
        positiveAreDeposits,
        dateFormat,
      })
      setImportResult(result)
      setState('result')
    } catch {
      setImportError('Import failed. Please try again.')
    } finally {
      setIsImporting(false)
    }
  }

  const handleGenerateTemplate = async () => {
    setIsGeneratingTemplate(true)
    setTemplateMessage(null)
    try {
      const result = await window.financeAPI.csvGenerateTemplate()
      setTemplateMessage(`Template saved to: ${result.savedPath}`)
    } catch {
      setTemplateMessage('Failed to generate template.')
    } finally {
      setIsGeneratingTemplate(false)
    }
  }

  const handleExportErrors = async () => {
    if (!importResult || importResult.failedRows.length === 0) return
    setIsExportingErrors(true)
    try {
      await window.financeAPI.csvExportErrorRows(
        importResult.failedRows.map((r) => r.rawLine)
      )
    } catch {
      // ignore
    } finally {
      setIsExportingErrors(false)
    }
  }

  const handleReset = () => {
    setPreview(null)
    setImportResult(null)
    setFileError(null)
    setImportError(null)
    setTemplateMessage(null)
    setState('idle')
  }

  const renderPreviewTable = (rows: CSVTransactionRow[]) => (
    <div className="csv-import-dialog__preview-table-wrap">
      <table className="csv-import-dialog__preview-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>Payee</th>
            <th>Amount</th>
            <th>Category</th>
            <th>Classification</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowNumber}>
              <td className="csv-import-dialog__preview-row-num">{row.rowNumber}</td>
              <td>{row.date}</td>
              <td>{row.payee || <span className="csv-import-dialog__empty">—</span>}</td>
              <td>{row.amount}</td>
              <td>{row.category || <span className="csv-import-dialog__empty">—</span>}</td>
              <td>{row.classification}</td>
              <td>{row.note || <span className="csv-import-dialog__empty">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <Dialog
      isOpen
      className="csv-import-dialog"
      panelClassName="csv-import-dialog__panel"
      bodyClassName="csv-import-dialog__body-wrap"
      title="Import Transactions from CSV"
      onClose={onClose}
    >
      <div className="csv-import-dialog__body">

          {/* Settings column */}
          <div className="csv-import-dialog__settings">

            {/* File selector */}
            <div className="csv-import-dialog__section">
              <label className="csv-import-dialog__label">CSV File</label>
              {state === 'idle' ? (
                <Button
                  type="button"
                  variant="square"
                  className="csv-import-dialog__file-btn"
                  onClick={handleSelectFile}
                  disabled={isLoadingFile}
                >
                  {isLoadingFile ? 'Opening…' : 'Select CSV File…'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="square"
                  className="csv-import-dialog__file-btn csv-import-dialog__file-btn--change"
                  onClick={handleSelectFile}
                  disabled={isLoadingFile || state === 'result'}
                >
                  {isLoadingFile ? 'Opening…' : 'Change File'}
                </Button>
              )}
              {fileError && (
                <p className="csv-import-dialog__field-error">{fileError}</p>
              )}
            </div>

            {/* Account */}
            <div className="csv-import-dialog__section">
              <Select
                id="import-account"
                label="Account"
                className="csv-import-dialog__select-wrap"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={state === 'result'}
              >
                {accounts.length === 0 ? (
                  <option value="">No accounts available</option>
                ) : (
                  accounts.map((a) => (
                    <option key={a.account_id} value={a.account_id}>
                      {a.account_name}
                    </option>
                  ))
                )}
              </Select>
            </div>

            {/* Date format */}
            <div className="csv-import-dialog__section">
              <Select
                id="import-date-format"
                label="Date Format"
                className="csv-import-dialog__select-wrap"
                value={dateFormat}
                disabled
              >
                <option value="DD-MM-YYYY">DD-MM-YYYY</option>
              </Select>
            </div>

            {/* Polarity */}
            <div className="csv-import-dialog__section">
              <label className="csv-import-dialog__label">Amount Convention</label>
              <div className="csv-import-dialog__radio-group">
                <label className="csv-import-dialog__radio">
                  <input
                    type="radio"
                    name="import-polarity"
                    checked={positiveAreDeposits}
                    onChange={() => setPositiveAreDeposits(true)}
                    disabled={state === 'result'}
                  />
                  Positives are deposits
                </label>
                <label className="csv-import-dialog__radio">
                  <input
                    type="radio"
                    name="import-polarity"
                    checked={!positiveAreDeposits}
                    onChange={() => setPositiveAreDeposits(false)}
                    disabled={state === 'result'}
                  />
                  Positives are withdrawals
                </label>
              </div>
            </div>

            {/* Template */}
            <div className="csv-import-dialog__section csv-import-dialog__section--template">
              <Button
                type="button"
                variant="subtle"
                className="csv-import-dialog__template-btn"
                onClick={handleGenerateTemplate}
                disabled={isGeneratingTemplate}
              >
                {isGeneratingTemplate ? 'Generating…' : 'Download Template'}
              </Button>
              {templateMessage && (
                <p className="csv-import-dialog__template-msg">{templateMessage}</p>
              )}
            </div>

          </div>

          {/* Right column: preview / result */}
          <div className="csv-import-dialog__right">

            {/* IDLE: placeholder */}
            {state === 'idle' && (
              <div className="csv-import-dialog__placeholder">
                <div className="csv-import-dialog__placeholder-icon">📄</div>
                <p>Select a CSV file to preview the first 5 transactions.</p>
              </div>
            )}

            {/* PREVIEWING: preview table + stats */}
            {state === 'previewing' && preview && (
              <div className="csv-import-dialog__preview">
                <div className="csv-import-dialog__preview-header">
                  <span className="csv-import-dialog__preview-title">Preview</span>
                  <span className="csv-import-dialog__preview-stats">
                    {preview.totalDataRows} row{preview.totalDataRows !== 1 ? 's' : ''}
                    {preview.emptyLineCount > 0 && (
                      <> · {preview.emptyLineCount} empty line{preview.emptyLineCount !== 1 ? 's' : ''} skipped</>
                    )}
                  </span>
                </div>
                {preview.previewRows.length > 0
                  ? renderPreviewTable(preview.previewRows)
                  : <p className="csv-import-dialog__empty-csv">No data rows found in the file.</p>
                }
              </div>
            )}

            {/* RESULT: import outcome */}
            {state === 'result' && importResult && (
              <div className="csv-import-dialog__result">
                <div className="csv-import-dialog__result-summary">
                  <div className="csv-import-dialog__result-stat csv-import-dialog__result-stat--success">
                    <span className="csv-import-dialog__result-count">{importResult.successCount}</span>
                    <span className="csv-import-dialog__result-label">Imported</span>
                  </div>
                  {importResult.emptyLineCount > 0 && (
                    <div className="csv-import-dialog__result-stat csv-import-dialog__result-stat--neutral">
                      <span className="csv-import-dialog__result-count">{importResult.emptyLineCount}</span>
                      <span className="csv-import-dialog__result-label">Empty lines skipped</span>
                    </div>
                  )}
                  {importResult.failedRows.length > 0 && (
                    <div className="csv-import-dialog__result-stat csv-import-dialog__result-stat--error">
                      <span className="csv-import-dialog__result-count">{importResult.failedRows.length}</span>
                      <span className="csv-import-dialog__result-label">Errors</span>
                    </div>
                  )}
                </div>

                {importResult.failedRows.length > 0 && (
                  <>
                    <div className="csv-import-dialog__error-table-header">
                      Failed rows
                    </div>
                    <div className="csv-import-dialog__error-table-wrap">
                      <table className="csv-import-dialog__error-table">
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Raw data</th>
                            <th>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.failedRows.map((row) => (
                            <tr key={row.rowNumber}>
                              <td className="csv-import-dialog__error-row-num">{row.rowNumber}</td>
                              <td className="csv-import-dialog__error-raw">{row.rawLine}</td>
                              <td className="csv-import-dialog__error-reason">{row.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="csv-import-dialog__footer">
          {importError && (
            <p className="csv-import-dialog__import-error">{importError}</p>
          )}

          {state !== 'result' && (
            <div className="csv-import-dialog__footer-actions">
              <Button type="button" variant="secondary" className="csv-import-dialog__btn-cancel" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="pill"
                className="csv-import-dialog__btn-import"
                onClick={handleImport}
                disabled={state !== 'previewing' || isImporting || !accountId || !preview || preview.totalDataRows === 0}
              >
                {isImporting ? 'Importing…' : 'Import'}
              </Button>
            </div>
          )}

          {state === 'result' && (
            <div className="csv-import-dialog__footer-actions">
              {importResult && importResult.failedRows.length > 0 && (
                <>
                  <Button
                    type="button"
                    variant="danger"
                    className="csv-import-dialog__btn-export-errors"
                    onClick={handleExportErrors}
                    disabled={isExportingErrors}
                  >
                    {isExportingErrors ? 'Saving…' : 'Export Errors to CSV'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="csv-import-dialog__btn-import-again"
                    onClick={handleReset}
                  >
                    Import Another File
                  </Button>
                </>
              )}
              <Button type="button" variant="secondary" className="csv-import-dialog__btn-cancel" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
    </Dialog>
  )
}
