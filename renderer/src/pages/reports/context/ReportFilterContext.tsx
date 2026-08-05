import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Account } from '../../../../../src/types/account'
import type { Category } from '../../../../../src/types/category'
import { Classification } from '../../../../../src/types/transaction'
import { CLASSIFICATION_OPTIONS, getDateRangeForPreset, type DateRangePreset } from '../../../utils/chartUtils'

interface ReportFilterValue {
  accounts: Account[]
  categories: Category[]
  isLoadingReferenceData: boolean
  referenceDataError: string | null

  datePreset: DateRangePreset
  setDatePreset: (preset: DateRangePreset) => void
  customFrom: string
  setCustomFrom: (value: string) => void
  customTo: string
  setCustomTo: (value: string) => void
  fromDate: Date
  toDate: Date

  /** null means "all", which keeps the filter stable as accounts are added. */
  selectedAccountIds: Set<number> | null
  setSelectedAccountIds: (next: Set<number> | null) => void
  selectedClassifications: Set<Classification> | null
  setSelectedClassifications: (next: Set<Classification> | null) => void

  activeAccountIds: Set<number>
  activeClassifications: Set<Classification>
  /** True when the user has deselected everything, so sections can short-circuit. */
  isSelectionEmpty: boolean
}

const ReportFilterContext = createContext<ReportFilterValue | undefined>(undefined)

function toDateInputValue(date: Date): string {
  return date.toISOString().split('T')[0]
}

function parseDateInput(value: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function resolveDateRange(
  preset: DateRangePreset,
  customFrom: string,
  customTo: string
): { from: Date; to: Date } {
  if (preset !== 'custom') {
    return getDateRangeForPreset(preset)
  }

  const parsedFrom = parseDateInput(customFrom)
  const parsedTo = parseDateInput(customTo)
  if (!parsedFrom || !parsedTo) {
    return getDateRangeForPreset('current-month')
  }

  if (parsedFrom.getTime() <= parsedTo.getTime()) {
    return { from: parsedFrom, to: parsedTo }
  }

  return { from: parsedTo, to: parsedFrom }
}

export function ReportFilterProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingReferenceData, setIsLoadingReferenceData] = useState(true)
  const [referenceDataError, setReferenceDataError] = useState<string | null>(null)

  const [datePreset, setDatePreset] = useState<DateRangePreset>('current-month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number> | null>(null)
  const [selectedClassifications, setSelectedClassifications] = useState<Set<Classification> | null>(null)

  useEffect(() => {
    const defaultRange = getDateRangeForPreset('current-month')
    setCustomFrom(toDateInputValue(defaultRange.from))
    setCustomTo(toDateInputValue(defaultRange.to))
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadReferenceData() {
      setIsLoadingReferenceData(true)
      setReferenceDataError(null)
      try {
        const [loadedAccounts, loadedCategories] = await Promise.all([
          window.financeAPI.listActiveAccounts(),
          window.financeAPI.listActiveCategories(),
        ])
        if (!isMounted) return

        setAccounts(loadedAccounts)
        setCategories(loadedCategories)
      } catch (err) {
        console.error(err)
        if (!isMounted) return
        setReferenceDataError('Failed to load report filters.')
      } finally {
        if (isMounted) setIsLoadingReferenceData(false)
      }
    }

    void loadReferenceData()

    return () => {
      isMounted = false
    }
  }, [])

  const range = useMemo(
    () => resolveDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo]
  )

  const activeAccountIds = useMemo(
    () => selectedAccountIds ?? new Set(accounts.map((account) => account.account_id)),
    [selectedAccountIds, accounts]
  )

  const activeClassifications = useMemo(
    () => selectedClassifications ?? new Set(CLASSIFICATION_OPTIONS),
    [selectedClassifications]
  )

  const value = useMemo<ReportFilterValue>(
    () => ({
      accounts,
      categories,
      isLoadingReferenceData,
      referenceDataError,
      datePreset,
      setDatePreset,
      customFrom,
      setCustomFrom,
      customTo,
      setCustomTo,
      fromDate: range.from,
      toDate: range.to,
      selectedAccountIds,
      setSelectedAccountIds,
      selectedClassifications,
      setSelectedClassifications,
      activeAccountIds,
      activeClassifications,
      isSelectionEmpty: activeAccountIds.size === 0 || activeClassifications.size === 0,
    }),
    [
      accounts,
      categories,
      isLoadingReferenceData,
      referenceDataError,
      datePreset,
      customFrom,
      customTo,
      range.from,
      range.to,
      selectedAccountIds,
      selectedClassifications,
      activeAccountIds,
      activeClassifications,
    ]
  )

  return <ReportFilterContext.Provider value={value}>{children}</ReportFilterContext.Provider>
}

export function useReportFilters(): ReportFilterValue {
  const context = useContext(ReportFilterContext)
  if (!context) {
    throw new Error('useReportFilters must be used within a ReportFilterProvider')
  }
  return context
}
