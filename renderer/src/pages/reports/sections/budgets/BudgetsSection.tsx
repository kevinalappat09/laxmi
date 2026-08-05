import { useMemo } from 'react'
import { BudgetStatus, BudgetType, type BudgetWithSpending } from '../../../../../../src/types/budget'
import { CHART_HEIGHT, buildHorizontalBarOption, buildPieOption, getSemanticChartColors } from '../../../../utils/reportOptions'
import { formatCurrency, formatPercent } from '../../../../utils/formatters'
import { MetricCard } from '../../components/MetricCard'
import { ReportChartCard } from '../../components/ReportChartCard'
import { SectionStatus } from '../../components/SectionStatus'
import { useBudgetReportData } from '../../hooks/useBudgetReportData'

const STATUS_LABELS: Record<BudgetStatus, string> = {
  [BudgetStatus.OnTrack]: 'On track',
  [BudgetStatus.Warning]: 'Warning',
  [BudgetStatus.OverBudget]: 'Over budget',
}

const SCOPE_LABELS: Record<BudgetType, string> = {
  [BudgetType.Overall]: 'Overall',
  [BudgetType.Account]: 'Account',
  [BudgetType.Category]: 'Category',
  [BudgetType.Classification]: 'Classification',
}

/** Rows grow the chart rather than squeezing into a fixed height. */
function chartHeightForRows(rowCount: number): number {
  return Math.max(CHART_HEIGHT, 80 + rowCount * 34)
}

function getRemaining(budget: BudgetWithSpending): number {
  return Math.max(0, budget.amount - budget.spent)
}

export function BudgetsSection() {
  const { budgets, isLoading, error } = useBudgetReportData()
  const colors = useMemo(() => getSemanticChartColors(), [])

  const sortedBudgets = useMemo(
    () => [...budgets].sort((a, b) => b.percentage - a.percentage),
    [budgets]
  )

  const budgetVsActualOption = useMemo(
    () =>
      buildHorizontalBarOption(
        sortedBudgets.map((budget) => budget.name),
        [
          {
            name: 'Spent',
            values: sortedBudgets.map((budget) => budget.spent),
            color: colors.expense,
          },
          {
            name: 'Remaining',
            values: sortedBudgets.map(getRemaining),
            color: colors.neutral,
          },
        ],
        { stacked: true }
      ),
    [sortedBudgets, colors]
  )

  const statusData = useMemo(() => {
    const counts = new Map<BudgetStatus, number>()
    budgets.forEach((budget) => {
      counts.set(budget.status, (counts.get(budget.status) ?? 0) + 1)
    })

    return Array.from(counts.entries()).map(([status, count]) => ({
      name: STATUS_LABELS[status],
      value: count,
    }))
  }, [budgets])

  const statusOption = useMemo(
    () =>
      buildPieOption(
        statusData,
        {
          [STATUS_LABELS[BudgetStatus.OnTrack]]: colors.income,
          [STATUS_LABELS[BudgetStatus.Warning]]: colors.accent,
          [STATUS_LABELS[BudgetStatus.OverBudget]]: colors.expense,
        },
        { valueFormat: 'count', totalLabel: 'Budgets' }
      ),
    [statusData, colors]
  )

  const scopeData = useMemo(() => {
    const totals = new Map<string, number>()
    budgets.forEach((budget) => {
      const label = SCOPE_LABELS[budget.budget_type]
      totals.set(label, (totals.get(label) ?? 0) + budget.spent)
    })

    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
  }, [budgets])

  const scopeOption = useMemo(() => buildPieOption(scopeData), [scopeData])

  const totals = useMemo(() => {
    const allocated = budgets.reduce((sum, budget) => sum + budget.amount, 0)
    const spent = budgets.reduce((sum, budget) => sum + budget.spent, 0)
    const atRisk = budgets.filter((budget) => budget.status !== BudgetStatus.OnTrack).length

    return {
      allocated,
      spent,
      remaining: Math.max(0, allocated - spent),
      usedPercent: allocated > 0 ? (spent / allocated) * 100 : null,
      atRisk,
    }
  }, [budgets])

  const periodLabel = budgets[0]?.period_label ?? 'the current period'

  return (
    <>
      <SectionStatus isLoading={isLoading} error={error} />

      {!isLoading && budgets.length === 0 ? (
        <p className="reports-page__loading">No active budgets yet. Create one on the Budgets page.</p>
      ) : (
        <>
          <div className="reports-page__metrics">
            <MetricCard label="Allocated" value={formatCurrency(totals.allocated, 0)} caption={periodLabel} />
            <MetricCard label="Spent" value={formatCurrency(totals.spent, 0)} />
            <MetricCard label="Remaining" value={formatCurrency(totals.remaining, 0)} tone="positive" />
            <MetricCard
              label="Budgets At Risk"
              value={`${totals.atRisk} of ${budgets.length}`}
              caption={totals.usedPercent != null ? `${formatPercent(totals.usedPercent)} of total allocation used` : undefined}
              tone={totals.atRisk > 0 ? 'negative' : 'positive'}
            />
          </div>

          <div className="reports-page__charts">
            <ReportChartCard
              title="Budget vs Actual"
              subtitle={`Spent against remaining allowance for ${periodLabel}`}
              option={budgetVsActualOption}
              hasData={sortedBudgets.length > 0}
              height={chartHeightForRows(sortedBudgets.length)}
              fullWidth
            />
            <ReportChartCard
              title="Budget Health"
              subtitle="How many budgets sit in each status"
              option={statusOption}
              hasData={statusData.length > 0}
            />
            <ReportChartCard
              title="Spending by Budget Scope"
              subtitle="Where budgeted spending is concentrated"
              option={scopeOption}
              hasData={scopeData.some((point) => point.value > 0)}
            />
          </div>
        </>
      )}
    </>
  )
}
