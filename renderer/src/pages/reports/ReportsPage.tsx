import { Button } from '../../components/ui/Button'
import { useNavigation } from '../../contexts/NavigationContext'
import { ReportFilterBar } from './components/ReportFilterBar'
import { ReportFilterProvider, useReportFilters } from './context/ReportFilterContext'
import { REPORT_SECTIONS, getReportSection } from './sections/registry'
import './ReportsPage.css'

function ReportsShell() {
  const { reportSection, setReportSection } = useNavigation()
  const { referenceDataError } = useReportFilters()

  const section = getReportSection(reportSection)
  const ActiveSection = section.Component

  return (
    <div className="reports-page">
      <div className="reports-page__header">
        <h1>Reports</h1>
        <p className="reports-page__header-description">{section.description}</p>
      </div>

      <nav className="reports-page__sections" aria-label="Report sections">
        {REPORT_SECTIONS.map((entry) => (
          <Button
            key={entry.id}
            variant="subtle"
            size="sm"
            aria-current={entry.id === section.id}
            className={`reports-page__section-button ${
              entry.id === section.id ? 'reports-page__section-button--active' : ''
            }`}
            onClick={() => setReportSection(entry.id)}
          >
            {entry.label}
          </Button>
        ))}
      </nav>

      <ReportFilterBar supports={section.supports} />

      {referenceDataError && <p className="reports-page__error">{referenceDataError}</p>}

      <ActiveSection />
    </div>
  )
}

export function ReportsPage() {
  return (
    <ReportFilterProvider>
      <ReportsShell />
    </ReportFilterProvider>
  )
}
