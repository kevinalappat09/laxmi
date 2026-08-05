import type { ComponentType } from 'react'

export type ReportSectionId = 'home' | 'transactions' | 'budgets' | 'portfolio' | 'credit-cards'

/**
 * How a section responds to the global date filter.
 *
 * range            - honors both ends of the selected range
 * reference-period - resolves to the calendar month or year containing the range end
 * from-only        - uses the range start and ignores the end
 * point-in-time    - reports balances as of the range end, with no history
 */
export type DateRangeSupport = 'range' | 'reference-period' | 'from-only' | 'point-in-time'

export interface ReportSectionSupports {
  dateRange: DateRangeSupport
  accounts: boolean
  classifications: boolean
}

export interface ReportSectionDef {
  id: ReportSectionId
  label: string
  description: string
  supports: ReportSectionSupports
  Component: ComponentType
}

const DATE_RANGE_NOTES: Record<DateRangeSupport, string | null> = {
  range: null,
  'reference-period': 'Budgets are tracked per calendar period, so this section uses the period containing the end of your selected range.',
  'from-only': 'Portfolio history runs from the start of your selected range up to today.',
  'point-in-time': 'Balances are shown as of the end of your selected range. No historical utilization is stored yet.',
}

/** Explains any way the section cannot honor the global filters, or null when it fully does. */
export function getFilterNote(supports: ReportSectionSupports): string | null {
  const notes: string[] = []

  const dateNote = DATE_RANGE_NOTES[supports.dateRange]
  if (dateNote) notes.push(dateNote)

  if (!supports.accounts && !supports.classifications) {
    notes.push('Account and classification filters do not apply here.')
  } else if (!supports.accounts) {
    notes.push('The account filter does not apply here.')
  } else if (!supports.classifications) {
    notes.push('The classification filter does not apply here.')
  }

  return notes.length > 0 ? notes.join(' ') : null
}
