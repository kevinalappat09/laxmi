import { useMemo } from 'react'
import { AccountSubType } from '../../../../../../src/types/account'
import { TransactionType, type Transaction } from '../../../../../../src/types/transaction'
import {
  bucketTransactionsDual,
  collapsePivotToTopN,
  getAutoAggregateBuckets,
  pivotByKey,
} from '../../../../utils/chartUtils'
import { formatCurrency, formatPercent } from '../../../../utils/formatters'
import {
  CHART_HEIGHT,
  assignSeriesColors,
  buildBarOption,
  buildHorizontalBarOption,
  buildMultiLineOption,
  getSemanticChartColors,
} from '../../../../utils/reportOptions'
import { MetricCard } from '../../components/MetricCard'
import { ReportChartCard } from '../../components/ReportChartCard'
import { SectionStatus } from '../../components/SectionStatus'
import { useReportFilters } from '../../context/ReportFilterContext'
import { useCreditCardReportData } from '../../hooks/useCreditCardReportData'
import { useTransactionReportData } from '../../hooks/useTransactionReportData'

function chartHeightForRows(rowCount: number): number {
  return Math.max(CHART_HEIGHT, 80 + rowCount * 34)
}

export function CreditCardsSection() {
  const { accounts, fromDate, toDate } = useReportFilters()
  const { summaries, isLoading, error } = useCreditCardReportData()
  const {
    transactions,
    isLoading: isLoadingTransactions,
    error: transactionsError,
  } = useTransactionReportData()
  const colors = useMemo(() => getSemanticChartColors(), [])

  const creditAccountIds = useMemo(
    () =>
      new Set(
        accounts
          .filter((account) => account.sub_type === AccountSubType.Credit)
          .map((account) => account.account_id)
      ),
    [accounts]
  )

  const creditTransactions = useMemo(
    () => transactions.filter((tx) => creditAccountIds.has(tx.account_id)),
    [transactions, creditAccountIds]
  )

  const buckets = useMemo(() => getAutoAggregateBuckets(fromDate, toDate), [fromDate, toDate])

  const sortedSummaries = useMemo(
    () => [...summaries].sort((a, b) => b.utilization - a.utilization),
    [summaries]
  )

  const utilizationOption = useMemo(
    () =>
      buildBarOption(
        sortedSummaries.map((summary) => ({
          label: summary.account.account_name,
          value: Number((summary.utilization * 100).toFixed(1)),
        })),
        'Utilization',
        { color: colors.expense, valueFormat: 'percent' }
      ),
    [sortedSummaries, colors]
  )

  const outstandingOption = useMemo(
    () =>
      buildHorizontalBarOption(
        sortedSummaries.map((summary) => summary.account.account_name),
        [
          {
            name: 'Outstanding',
            values: sortedSummaries.map((summary) => Number(summary.outstanding.toFixed(2))),
            color: colors.expense,
          },
          {
            name: 'Available',
            values: sortedSummaries.map((summary) => Number(Math.max(0, summary.available).toFixed(2))),
            color: colors.neutral,
          },
        ],
        { stacked: true }
      ),
    [sortedSummaries, colors]
  )

  const spendOverTimeData = useMemo(
    () => bucketTransactionsDual(creditTransactions, buckets),
    [creditTransactions, buckets]
  )

  const spendOverTimeOption = useMemo(
    () =>
      buildBarOption(
        spendOverTimeData.map((point) => ({ label: point.label, value: point.expense })),
        'Credit spend',
        { color: colors.expense }
      ),
    [spendOverTimeData, colors]
  )

  const accountNameById = useMemo(
    () => new Map(accounts.map((account) => [account.account_id, account.account_name])),
    [accounts]
  )

  const perCardPivot = useMemo(
    () =>
      collapsePivotToTopN(
        pivotByKey(
          creditTransactions,
          buckets,
          (tx: Transaction) => accountNameById.get(tx.account_id) ?? `Account ${tx.account_id}`,
          TransactionType.Withdraw
        )
      ),
    [creditTransactions, buckets, accountNameById]
  )

  const perCardColorMap = useMemo(
    () => assignSeriesColors(perCardPivot.seriesKeys),
    [perCardPivot]
  )

  const perCardOption = useMemo(
    () => buildMultiLineOption(perCardPivot.data, perCardPivot.seriesKeys, perCardColorMap),
    [perCardPivot, perCardColorMap]
  )

  const totals = useMemo(() => {
    const outstanding = summaries.reduce((sum, summary) => sum + summary.outstanding, 0)
    const limit = summaries.reduce((sum, summary) => sum + summary.details.credit_limit, 0)
    const spend = creditTransactions
      .filter((tx) => tx.transaction_type === TransactionType.Withdraw)
      .reduce((sum, tx) => sum + tx.amount, 0)

    return {
      outstanding,
      limit,
      available: Math.max(0, limit - outstanding),
      utilization: limit > 0 ? (outstanding / limit) * 100 : null,
      spend,
    }
  }, [summaries, creditTransactions])

  const combinedLoading = isLoading || isLoadingTransactions

  return (
    <>
      <SectionStatus isLoading={combinedLoading} error={error ?? transactionsError} />

      {!combinedLoading && summaries.length === 0 ? (
        <p className="reports-page__loading">
          No credit cards configured yet. Add credit details to a liability account first.
        </p>
      ) : (
        <>
          <div className="reports-page__metrics">
            <MetricCard label="Total Outstanding" value={formatCurrency(totals.outstanding, 0)} tone="negative" />
            <MetricCard label="Available Credit" value={formatCurrency(totals.available, 0)} tone="positive" />
            <MetricCard
              label="Overall Utilization"
              value={formatPercent(totals.utilization)}
              caption={`Across ${summaries.length} card${summaries.length === 1 ? '' : 's'}`}
            />
            <MetricCard label="Credit Spend In Range" value={formatCurrency(totals.spend, 0)} />
          </div>

          <div className="reports-page__charts">
            <ReportChartCard
              title="Utilization by Card"
              subtitle="Outstanding as a share of each card's limit, right now"
              option={utilizationOption}
              hasData={sortedSummaries.length > 0}
            />
            <ReportChartCard
              title="Outstanding vs Available"
              subtitle="How much headroom each card still has"
              option={outstandingOption}
              hasData={sortedSummaries.length > 0}
              height={chartHeightForRows(sortedSummaries.length)}
            />
            <ReportChartCard
              title="Credit Spend Over Time"
              subtitle="Withdrawals on credit accounts per time bucket"
              option={spendOverTimeOption}
              hasData={creditTransactions.length > 0}
            />
            <ReportChartCard
              title="Credit Spend by Card"
              subtitle="Which card carries the spending"
              option={perCardOption}
              hasData={perCardPivot.seriesKeys.length > 0}
            />
          </div>
        </>
      )}
    </>
  )
}
