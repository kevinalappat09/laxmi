import { useEffect, useState } from 'react'
import type { CreditCardSummary } from '../../../../../src/types/creditCard'
import { useReportFilters } from '../context/ReportFilterContext'

interface CreditCardReportData {
  summaries: CreditCardSummary[]
  isLoading: boolean
  error: string | null
}

/**
 * Utilization is point-in-time by design: no utilization history is stored, so the
 * summaries reflect balances as of the end of the selected range.
 */
export function useCreditCardReportData(): CreditCardReportData {
  const { toDate } = useReportFilters()

  const [summaries, setSummaries] = useState<CreditCardSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const referenceTime = toDate.getTime()

  useEffect(() => {
    let isMounted = true

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const loaded = await window.financeAPI.listCreditCardSummaries(new Date(referenceTime))
        if (!isMounted) return
        setSummaries(loaded)
      } catch (err) {
        console.error(err)
        if (!isMounted) return
        setError('Failed to load credit card data.')
        setSummaries([])
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [referenceTime])

  return { summaries, isLoading, error }
}
