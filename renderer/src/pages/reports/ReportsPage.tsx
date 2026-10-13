import { PageHeader, SegmentedControl } from '../../components/ui'
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
      <PageHeader title="Reports" description={section.description} />

      <SegmentedControl className="reports-page__sections" size="sm" ariaLabel="Report sections" value={section.id} onValueChange={(value) => setReportSection(value as typeof section.id)} options={REPORT_SECTIONS.map((entry) => ({ value: entry.id, label: entry.label }))} />

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
