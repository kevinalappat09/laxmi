const APP_LOCALE = 'en-IN'
const APP_CURRENCY = 'INR'

const EMPTY_VALUE = '--'

const currencyFormatterCache = new Map<number, Intl.NumberFormat>()

function getCurrencyFormatter(decimals: number): Intl.NumberFormat {
  const cached = currencyFormatterCache.get(decimals)
  if (cached) return cached

  const formatter = new Intl.NumberFormat(APP_LOCALE, {
    style: 'currency',
    currency: APP_CURRENCY,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
  currencyFormatterCache.set(decimals, formatter)
  return formatter
}

const compactCurrencyFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: 'currency',
  currency: APP_CURRENCY,
  notation: 'compact',
  maximumFractionDigits: 1
})

const percentFormatter = new Intl.NumberFormat(APP_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const dateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
})

function isBlank(value: number | null | undefined): value is null | undefined {
  return value == null || Number.isNaN(value)
}

export function formatCurrency(value: number | null | undefined, decimals = 2): string {
  if (isBlank(value)) return EMPTY_VALUE
  return getCurrencyFormatter(decimals).format(value)
}

/** Compact notation using the locale's own scale, so Indian values read as L and Cr. */
export function formatCurrencyCompact(value: number | null | undefined): string {
  if (isBlank(value)) return EMPTY_VALUE
  return compactCurrencyFormatter.format(value)
}

/** Prefixes a plus sign for gains so deltas read unambiguously next to losses. */
export function formatSignedCurrency(value: number | null | undefined, decimals = 2): string {
  if (isBlank(value)) return EMPTY_VALUE
  return `${value >= 0 ? '+' : ''}${formatCurrency(value, decimals)}`
}

export function formatPercent(value: number | null | undefined): string {
  if (isBlank(value)) return EMPTY_VALUE
  return `${percentFormatter.format(value)}%`
}

export function formatSignedPercent(value: number | null | undefined): string {
  if (isBlank(value)) return EMPTY_VALUE
  return `${value >= 0 ? '+' : ''}${formatPercent(value)}`
}

export function formatDate(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  return dateFormatter.format(date)
}
