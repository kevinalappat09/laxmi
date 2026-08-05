interface SectionStatusProps {
  isLoading: boolean
  error: string | null
}

export function SectionStatus({ isLoading, error }: SectionStatusProps) {
  if (error) return <p className="reports-page__error">{error}</p>
  if (isLoading) return <p className="reports-page__loading">Loading report data…</p>
  return null
}
