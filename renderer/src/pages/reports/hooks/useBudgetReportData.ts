import { useEffect, useState } from 'react'
import type { BudgetWithSpending } from '../../../../../src/types/budget'
import { useReportFilters } from '../context/ReportFilterContext'

interface BudgetReportData {
  budgets: BudgetWithSpending[]
  /** The date budget periods were resolved against, for labelling the section. */
  referenceDate: Date
  isLoading: boolean
  error: string | null
}

/**
 * Budget spending is resolved per calendar period rather than an arbitrary range, so the
 * end of the selected range is used as the reference date.
 */
export function useBudgetReportData(): BudgetReportData {
  const { toDate } = useReportFilters()

  const [budgets, setBudgets] = useState<BudgetWithSpending[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const referenceTime = toDate.getTime()

  useEffect(() => {
    let isMounted = true

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const loaded = await window.financeAPI.listBudgetsWithSpending(new Date(referenceTime))
        if (!isMounted) return
        setBudgets(loaded)
      } catch (err) {
        console.error(err)
        if (!isMounted) return
        setError('Failed to load budget data.')
        setBudgets([])
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [referenceTime])

  return { budgets, referenceDate: new Date(referenceTime), isLoading, error }
}
