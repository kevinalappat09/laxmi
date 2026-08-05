import { ReportsHome } from '../ReportsHome'
import { BudgetsSection } from './budgets/BudgetsSection'
import { CreditCardsSection } from './creditCards/CreditCardsSection'
import { PortfolioSection } from './portfolio/PortfolioSection'
import { TransactionsSection } from './transactions/TransactionsSection'
import type { ReportSectionDef, ReportSectionId } from './types'

export const REPORT_SECTIONS: ReportSectionDef[] = [
  {
    id: 'home',
    label: 'Overview',
    description: 'Savings at a glance, with a summary of every reporting domain.',
    supports: { dateRange: 'range', accounts: true, classifications: true },
    Component: ReportsHome,
  },
  {
    id: 'transactions',
    label: 'Transactions',
    description: 'Cash flow, savings rate, categories, classifications and accounts.',
    supports: { dateRange: 'range', accounts: true, classifications: true },
    Component: TransactionsSection,
  },
  {
    id: 'budgets',
    label: 'Budgets',
    description: 'Budget against actual spending for the current period.',
    supports: { dateRange: 'reference-period', accounts: false, classifications: false },
    Component: BudgetsSection,
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    description: 'Invested against market value, allocation and returns.',
    supports: { dateRange: 'from-only', accounts: false, classifications: false },
    Component: PortfolioSection,
  },
  {
    id: 'credit-cards',
    label: 'Credit Cards',
    description: 'Utilization, outstanding balances and credit spending.',
    supports: { dateRange: 'point-in-time', accounts: true, classifications: true },
    Component: CreditCardsSection,
  },
]

export function getReportSection(id: ReportSectionId): ReportSectionDef {
  return REPORT_SECTIONS.find((section) => section.id === id) ?? REPORT_SECTIONS[0]
}
