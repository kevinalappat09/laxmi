import { useState } from 'react'
import { Button } from '../../../../components/ui/Button'
import { useReportFilters } from '../../context/ReportFilterContext'
import { usePortfolioTransactions } from '../../hooks/usePortfolioTransactions'
import { useTransactionReportData } from '../../hooks/useTransactionReportData'
import { SectionStatus } from '../../components/SectionStatus'
import { AccountsTab } from './AccountsTab'
import { CategoryTab } from './CategoryTab'
import { ClassificationTab } from './ClassificationTab'
import { OverviewTab } from './OverviewTab'

type TransactionTab = 'overview' | 'category' | 'classification' | 'accounts'

const TABS: Array<{ id: TransactionTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'category', label: 'Category' },
  { id: 'classification', label: 'Classification' },
  { id: 'accounts', label: 'Accounts' },
]

export function TransactionsSection() {
  const { accounts, categories, fromDate, toDate } = useReportFilters()
  const { transactions, isLoading, error } = useTransactionReportData()
  const { transactionsInRange: portfolioTransactions } = usePortfolioTransactions()
  const [activeTab, setActiveTab] = useState<TransactionTab>('overview')

  return (
    <>
      <div className="reports-page__tabs" role="tablist" aria-label="Transaction reports">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            variant="subtle"
            size="sm"
            className={`reports-page__tab-button ${
              activeTab === tab.id ? 'reports-page__tab-button--active' : ''
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <SectionStatus isLoading={isLoading} error={error} />

      {activeTab === 'overview' && (
        <OverviewTab
          transactions={transactions}
          portfolioTransactions={portfolioTransactions}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}
      {activeTab === 'category' && (
        <CategoryTab
          transactions={transactions}
          categories={categories}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}
      {activeTab === 'classification' && (
        <ClassificationTab transactions={transactions} fromDate={fromDate} toDate={toDate} />
      )}
      {activeTab === 'accounts' && (
        <AccountsTab transactions={transactions} accounts={accounts} />
      )}
    </>
  )
}
