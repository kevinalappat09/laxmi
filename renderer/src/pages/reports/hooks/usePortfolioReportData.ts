import { useEffect, useState } from 'react'
import type { PortfolioSummaryAnalytics, PortfolioValuePoint } from '../../../../../src/types/portfolioAnalytics'
import type { PortfolioTransaction } from '../../../../../src/types/portfolioTransaction'
import { useReportFilters } from '../context/ReportFilterContext'
import { usePortfolioTransactions } from './usePortfolioTransactions'

interface PortfolioReportData {
  summary: PortfolioSummaryAnalytics | null
  valueHistory: PortfolioValuePoint[]
  transactionsInRange: PortfolioTransaction[]
  isLoading: boolean
  error: string | null
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function usePortfolioReportData(): PortfolioReportData {
  const { fromDate } = useReportFilters()
  const { transactionsInRange, isLoading: isLoadingTransactions, error: transactionsError } =
    usePortfolioTransactions()

  const [summary, setSummary] = useState<PortfolioSummaryAnalytics | null>(null)
  const [valueHistory, setValueHistory] = useState<PortfolioValuePoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fromTime = fromDate.getTime()

  useEffect(() => {
    let isMounted = true

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const [loadedSummary, loadedHistory] = await Promise.all([
          window.financeAPI.portfolio.analytics.summary(),
          window.financeAPI.portfolio.analytics.valueHistory(toIsoDate(new Date(fromTime))),
        ])
        if (!isMounted) return

        setSummary(loadedSummary)
        setValueHistory(loadedHistory)
      } catch (err) {
        console.error(err)
        if (!isMounted) return
        setError('Failed to load portfolio analytics.')
        setSummary(null)
        setValueHistory([])
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [fromTime])

  return {
    summary,
    valueHistory,
    transactionsInRange,
    isLoading: isLoading || isLoadingTransactions,
    error: error ?? transactionsError,
  }
}
