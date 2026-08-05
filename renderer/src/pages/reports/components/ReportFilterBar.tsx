import { useMemo } from 'react'
import { Classification } from '../../../../../src/types/transaction'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Select } from '../../../components/ui/Input'
import { MultiSelectDropdown } from '../../../components/ui/MultiSelectDropdown'
import { CLASSIFICATION_OPTIONS, type DateRangePreset } from '../../../utils/chartUtils'
import { useReportFilters } from '../context/ReportFilterContext'
import { getFilterNote, type ReportSectionSupports } from '../sections/types'

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

interface ReportFilterBarProps {
  supports: ReportSectionSupports
}

export function ReportFilterBar({ supports }: ReportFilterBarProps) {
  const {
    accounts,
    datePreset,
    setDatePreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    selectedAccountIds,
    setSelectedAccountIds,
    selectedClassifications,
    setSelectedClassifications,
  } = useReportFilters()

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: String(account.account_id),
        label: account.account_name,
      })),
    [accounts]
  )

  const classificationOptions = useMemo(
    () =>
      CLASSIFICATION_OPTIONS.map((classification) => ({
        value: classification,
        label: capitalize(classification),
      })),
    []
  )

  const note = getFilterNote(supports)

  return (
    <Card className="reports-page__filters">
      <div className="reports-page__filter-grid">
        <Select
          id="reports-date-range"
          label="Date range"
          className="reports-page__field"
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value as DateRangePreset)}
        >
          <option value="last-7-days">Last 7 days</option>
          <option value="last-14-days">Last 14 days</option>
          <option value="current-month">Current month</option>
          <option value="last-month">Last month</option>
          <option value="last-30-days">Last 30 days</option>
          <option value="current-year">Current year</option>
          <option value="last-year">Last year</option>
          <option value="custom">Custom</option>
        </Select>

        {datePreset === 'custom' && (
          <>
            <div className="ui-field reports-page__field">
              <label className="ui-field__label" htmlFor="reports-custom-from">
                Date from
              </label>
              <input
                id="reports-custom-from"
                className="ui-field__control"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="ui-field reports-page__field">
              <label className="ui-field__label" htmlFor="reports-custom-to">
                Date to
              </label>
              <input
                id="reports-custom-to"
                className="ui-field__control"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </>
        )}

        {supports.accounts && (
          <div className="reports-page__field-actions">
            <MultiSelectDropdown
              id="reports-account-filter"
              label="Account"
              className="reports-page__field reports-page__field-actions-control"
              options={accountOptions}
              selectedValues={
                selectedAccountIds
                  ? Array.from(selectedAccountIds, String)
                  : accountOptions.map((option) => option.value)
              }
              onChange={(values) => {
                const next = new Set(values.map(Number))
                setSelectedAccountIds(next.size === accountOptions.length ? null : next)
              }}
              placeholder="No accounts"
              allSelectedLabel="All accounts"
              disabled={accountOptions.length === 0}
            />
            <div className="reports-page__field-actions-buttons">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setSelectedAccountIds(null)}
                disabled={accountOptions.length === 0}
              >
                All
              </Button>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setSelectedAccountIds(new Set())}
                disabled={accountOptions.length === 0}
              >
                None
              </Button>
            </div>
          </div>
        )}

        {supports.classifications && (
          <div className="reports-page__field-actions">
            <MultiSelectDropdown
              id="reports-classification-filter"
              label="Classification"
              className="reports-page__field reports-page__field-actions-control"
              options={classificationOptions}
              selectedValues={
                selectedClassifications
                  ? Array.from(selectedClassifications)
                  : classificationOptions.map((option) => option.value)
              }
              onChange={(values) => {
                const next = new Set(values as Classification[])
                setSelectedClassifications(next.size === classificationOptions.length ? null : next)
              }}
              placeholder="No classifications"
              allSelectedLabel="All classifications"
            />
            <div className="reports-page__field-actions-buttons">
              <Button variant="subtle" size="sm" onClick={() => setSelectedClassifications(null)}>
                All
              </Button>
              <Button variant="subtle" size="sm" onClick={() => setSelectedClassifications(new Set())}>
                None
              </Button>
            </div>
          </div>
        )}
      </div>

      {note && <p className="reports-page__filter-note">{note}</p>}
    </Card>
  )
}
