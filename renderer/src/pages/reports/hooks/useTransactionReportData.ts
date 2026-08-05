import { useEffect, useMemo, useState } from 'react'
import type { Transaction } from '../../../../../src/types/transaction'
import { useReportFilters } from '../context/ReportFilterContext'

interface TransactionReportData {
  transactions: Transaction[]
  isLoading: boolean
  error: string | null
}

/**
 * Loads transactions for the active date range and applies the global account and
 * classification filters. Sections opt into this rather than the shell loading it
 * for every section up front.
 */
export function useTransactionReportData(): TransactionReportData {
  const {
    accounts,
    fromDate,
    toDate,
    activeAccountIds,
    activeClassifications,
    isSelectionEmpty,
    isLoadingReferenceData,
  } = useReportFilters()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fromTime = fromDate.getTime()
  const toTime = toDate.getTime()

  useEffect(() => {
    let isMounted = true

    async function loadTransactions() {
      setIsLoading(true)
      setError(null)
      try {
        if (accounts.length === 0) {
          if (isMounted) setTransactions([])
          return
        }

        const results = await Promise.all(
          accounts.map((account) =>
            window.financeAPI.findTransactionsWithFilter({
              accountId: account.account_id,
              fromDate: new Date(fromTime),
              toDate: new Date(toTime),
            })
          )
        )
        if (!isMounted) return

        const merged = results.flat()
        merged.sort(
          (a, b) =>
            new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
        )
        setTransactions(merged)
      } catch (err) {
        console.error(err)
        if (!isMounted) return
        setError('Failed to load transaction data.')
        setTransactions([])
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadTransactions()

    return () => {
      isMounted = false
    }
  }, [accounts, fromTime, toTime])

  const filtered = useMemo(() => {
    if (isSelectionEmpty) return []
    return transactions.filter(
      (tx) => activeAccountIds.has(tx.account_id) && activeClassifications.has(tx.classification)
    )
  }, [transactions, activeAccountIds, activeClassifications, isSelectionEmpty])

  // Accounts drive the query, so the section is still loading until they have arrived.
  return { transactions: filtered, isLoading: isLoading || isLoadingReferenceData, error }
}
