import { useEffect, useMemo, useState } from 'react'
import type { PortfolioTransaction } from '../../../../../src/types/portfolioTransaction'
import { filterPortfolioTransactionsByRange } from '../../../utils/savingsUtils'
import { useReportFilters } from '../context/ReportFilterContext'

interface PortfolioTransactionsData {
  transactions: PortfolioTransaction[]
  /** Portfolio transactions inside the active report date range. */
  transactionsInRange: PortfolioTransaction[]
  isLoading: boolean
  error: string | null
}

/**
 * Portfolio transactions on their own, without the heavier analytics payload. Savings
 * metrics need these to tell investing apart from spending.
 */
export function usePortfolioTransactions(): PortfolioTransactionsData {
  const { fromDate, toDate } = useReportFilters()

  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fromTime = fromDate.getTime()
  const toTime = toDate.getTime()

  useEffect(() => {
    let isMounted = true

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const loaded = await window.financeAPI.portfolio.transaction.listAll()
        if (!isMounted) return
        setTransactions(loaded)
      } catch (err) {
        console.error(err)
        if (!isMounted) return
        setError('Failed to load portfolio transactions.')
        setTransactions([])
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [])

  const transactionsInRange = useMemo(
    () => filterPortfolioTransactionsByRange(transactions, new Date(fromTime), new Date(toTime)),
    [transactions, fromTime, toTime]
  )

  return { transactions, transactionsInRange, isLoading, error }
}
