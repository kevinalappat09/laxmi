import { useMemo } from 'react'
import { BudgetStatus } from '../../../../src/types/budget'
import { Card } from '../../components/ui/Card'
import { useNavigation } from '../../contexts/NavigationContext'
import { formatCurrency, formatPercent, formatSignedCurrency } from '../../utils/formatters'
import { computeSavings } from '../../utils/savingsUtils'
import { MetricCard } from './components/MetricCard'
import { SectionStatus } from './components/SectionStatus'
import { useBudgetReportData } from './hooks/useBudgetReportData'
import { useCreditCardReportData } from './hooks/useCreditCardReportData'
import { usePortfolioReportData } from './hooks/usePortfolioReportData'
import { useTransactionReportData } from './hooks/useTransactionReportData'
import type { ReportSectionId } from './sections/types'

interface SummaryCardProps {
  title: string
  description: string
  rows: Array<{ label: string; value: string }>
  onOpen: () => void
}

function SummaryCard({ title, description, rows, onOpen }: SummaryCardProps) {
  return (
    <Card className="reports-home__card">
      <div className="reports-home__card-header">
        <h2>{title}</h2>
      </div>
      <p className="reports-home__card-description">{description}</p>
      <dl className="reports-home__card-rows">
        {rows.map((row) => (
          <div key={row.label} className="reports-home__card-row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="reports-home__card-cta" onClick={onOpen}>
        View report →
      </button>
    </Card>
  )
}

export function ReportsHome() {
  const { openReportSection } = useNavigation()
  const transactionData = useTransactionReportData()
  const portfolioData = usePortfolioReportData()
  const budgetData = useBudgetReportData()
  const creditCardData = useCreditCardReportData()

  const savings = useMemo(
    () => computeSavings(transactionData.transactions, portfolioData.transactionsInRange),
    [transactionData.transactions, portfolioData.transactionsInRange]
  )

  const budgetRows = useMemo(() => {
    const atRisk = budgetData.budgets.filter((budget) => budget.status !== BudgetStatus.OnTrack).length
    const allocated = budgetData.budgets.reduce((sum, budget) => sum + budget.amount, 0)
    const spent = budgetData.budgets.reduce((sum, budget) => sum + budget.spent, 0)

    return [
      { label: 'Active budgets', value: String(budgetData.budgets.length) },
      { label: 'At risk', value: String(atRisk) },
      { label: 'Spent of allocated', value: `${formatCurrency(spent, 0)} of ${formatCurrency(allocated, 0)}` },
    ]
  }, [budgetData.budgets])

  const portfolioRows = useMemo(() => {
    const summary = portfolioData.summary
    return [
      { label: 'Current value', value: formatCurrency(summary?.totalCurrentValue, 0) },
      { label: 'Total return', value: formatSignedCurrency(summary?.totalPl, 0) },
      { label: 'XIRR', value: formatPercent(summary?.xirr != null ? summary.xirr * 100 : null) },
    ]
  }, [portfolioData.summary])

  const creditCardRows = useMemo(() => {
    const outstanding = creditCardData.summaries.reduce((sum, entry) => sum + entry.outstanding, 0)
    const limit = creditCardData.summaries.reduce((sum, entry) => sum + entry.details.credit_limit, 0)

    return [
      { label: 'Cards tracked', value: String(creditCardData.summaries.length) },
      { label: 'Outstanding', value: formatCurrency(outstanding, 0) },
      { label: 'Utilization', value: formatPercent(limit > 0 ? (outstanding / limit) * 100 : null) },
    ]
  }, [creditCardData.summaries])

  const transactionRows = useMemo(
    () => [
      { label: 'Transactions in range', value: String(transactionData.transactions.length) },
      { label: 'Income', value: formatCurrency(savings.income, 0) },
      { label: 'Expense', value: formatCurrency(savings.expense, 0) },
    ],
    [transactionData.transactions.length, savings]
  )

  const isLoading =
    transactionData.isLoading || portfolioData.isLoading || budgetData.isLoading || creditCardData.isLoading

  const firstError =
    transactionData.error ?? portfolioData.error ?? budgetData.error ?? creditCardData.error

  function open(section: ReportSectionId) {
    openReportSection(section)
  }

  return (
    <>
      <SectionStatus isLoading={isLoading} error={firstError} />

      <div className="reports-page__metrics">
        <MetricCard
          label="Income"
          value={formatCurrency(savings.income, 0)}
          caption={
            savings.capitalReturned > 0
              ? `${formatCurrency(savings.capitalReturned, 0)} of returned capital excluded`
              : undefined
          }
        />
        <MetricCard
          label="Expense"
          value={formatCurrency(savings.expense, 0)}
          caption={
            savings.investmentOutflow > 0
              ? `${formatCurrency(savings.investmentOutflow, 0)} invested, not spent`
              : undefined
          }
        />
        <MetricCard
          label="Net Savings"
          value={formatSignedCurrency(savings.netSavings, 0)}
          tone={savings.netSavings >= 0 ? 'positive' : 'negative'}
        />
        <MetricCard
          label="Savings Rate"
          value={formatPercent(savings.savingsRate)}
          caption="Share of income kept, investments counted as saved"
          tone={savings.savingsRate != null && savings.savingsRate >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <div className="reports-home__grid">
        <SummaryCard
          title="Transactions"
          description="Cash flow, savings rate, and where money goes by category, classification and account."
          rows={transactionRows}
          onOpen={() => open('transactions')}
        />
        <SummaryCard
          title="Budgets"
          description="Budget against actual spending for the current period, and which budgets need attention."
          rows={budgetRows}
          onOpen={() => open('budgets')}
        />
        <SummaryCard
          title="Portfolio"
          description="Invested against market value, allocation, and returns across your holdings."
          rows={portfolioRows}
          onOpen={() => open('portfolio')}
        />
        <SummaryCard
          title="Credit Cards"
          description="Utilization, outstanding balances, and spending on credit accounts."
          rows={creditCardRows}
          onOpen={() => open('credit-cards')}
        />
      </div>
    </>
  )
}
