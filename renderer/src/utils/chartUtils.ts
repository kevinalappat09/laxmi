import { Classification, TransactionType, type Transaction } from '../../../src/types/transaction'

export type DateRangePreset =
  | 'last-7-days'
  | 'last-14-days'
  | 'current-month'
  | 'last-month'
  | 'last-30-days'
  | 'current-year'
  | 'last-year'
  | 'custom'

export interface DateRange {
  from: Date
  to: Date
}

export interface Bucket {
  start: Date
  end: Date
  label: string
}

export interface ValuePoint {
  label: string
  value: number
}

export interface IncomeExpensePoint {
  label: string
  income: number
  expense: number
}

export interface PivotResult {
  data: Array<{ label: string } & Record<string, number | string>>
  seriesKeys: string[]
}

const monthShortFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
})

function startOfDay(value: Date): Date {
  const result = new Date(value)
  result.setHours(0, 0, 0, 0)
  return result
}

function endOfDay(value: Date): Date {
  const result = new Date(value)
  result.setHours(23, 59, 59, 999)
  return result
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value)
  result.setDate(result.getDate() + days)
  return result
}

function addMonths(value: Date, months: number): Date {
  const result = new Date(value)
  result.setMonth(result.getMonth() + months)
  return result
}

function diffInDaysInclusive(from: Date, to: Date): number {
  const start = startOfDay(from).getTime()
  const end = startOfDay(to).getTime()
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1
}

function diffInCalendarMonths(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1
}

function toDayMonth(value: Date): string {
  const day = `${value.getDate()}`.padStart(2, '0')
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  return `${day}/${month}`
}

function toMonthYearLabel(value: Date): string {
  return `${monthShortFormatter.format(value)} ${String(value.getFullYear()).slice(-2)}`
}

function clampDate(date: Date, lower: Date, upper: Date): Date {
  if (date.getTime() < lower.getTime()) return new Date(lower)
  if (date.getTime() > upper.getTime()) return new Date(upper)
  return new Date(date)
}

function normalizeRange(from: Date, to: Date): DateRange {
  if (from.getTime() <= to.getTime()) {
    return { from: startOfDay(from), to: endOfDay(to) }
  }
  return { from: startOfDay(to), to: endOfDay(from) }
}

export function getDateRangeForPreset(preset: DateRangePreset): DateRange {
  const today = new Date()
  const todayStart = startOfDay(today)
  const todayEnd = endOfDay(today)

  switch (preset) {
    case 'last-7-days':
      return { from: addDays(todayStart, -6), to: todayEnd }
    case 'last-14-days':
      return { from: addDays(todayStart, -13), to: todayEnd }
    case 'current-month':
      return {
        from: new Date(today.getFullYear(), today.getMonth(), 1),
        to: todayEnd,
      }
    case 'last-month':
      return {
        from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        to: endOfDay(new Date(today.getFullYear(), today.getMonth(), 0)),
      }
    case 'last-30-days':
      return { from: addDays(todayStart, -29), to: todayEnd }
    case 'current-year':
      return { from: new Date(today.getFullYear(), 0, 1), to: todayEnd }
    case 'last-year':
      return {
        from: new Date(today.getFullYear() - 1, 0, 1),
        to: endOfDay(new Date(today.getFullYear() - 1, 11, 31)),
      }
    case 'custom':
      return { from: todayStart, to: todayEnd }
    default: {
      const neverPreset: never = preset
      throw new Error(`Unhandled date range preset: ${neverPreset}`)
    }
  }
}

function buildFixedBuckets(
  range: DateRange,
  stepInDays: number,
  buildLabel: (start: Date, end: Date) => string
): Bucket[] {
  const buckets: Bucket[] = []
  let cursor = startOfDay(range.from)

  while (cursor.getTime() <= range.to.getTime()) {
    const bucketStart = new Date(cursor)
    const naturalEnd = endOfDay(addDays(bucketStart, stepInDays - 1))
    const bucketEnd = clampDate(naturalEnd, range.from, range.to)

    buckets.push({
      start: bucketStart,
      end: bucketEnd,
      label: buildLabel(bucketStart, bucketEnd),
    })

    cursor = addDays(bucketStart, stepInDays)
  }

  return buckets
}

function buildMonthlyBuckets(range: DateRange): Bucket[] {
  const buckets: Bucket[] = []
  let cursor = new Date(range.from.getFullYear(), range.from.getMonth(), 1)

  while (cursor.getTime() <= range.to.getTime()) {
    const monthStart = clampDate(startOfDay(cursor), range.from, range.to)
    const monthEnd = clampDate(
      endOfDay(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)),
      range.from,
      range.to
    )

    buckets.push({
      start: monthStart,
      end: monthEnd,
      label: toMonthYearLabel(monthStart),
    })

    cursor = addMonths(cursor, 1)
  }

  return buckets
}

function buildYearlyBuckets(range: DateRange): Bucket[] {
  const buckets: Bucket[] = []
  let cursor = new Date(range.from.getFullYear(), 0, 1)

  while (cursor.getTime() <= range.to.getTime()) {
    const yearStart = clampDate(startOfDay(cursor), range.from, range.to)
    const yearEnd = clampDate(
      endOfDay(new Date(cursor.getFullYear(), 11, 31)),
      range.from,
      range.to
    )

    buckets.push({
      start: yearStart,
      end: yearEnd,
      label: String(yearStart.getFullYear()),
    })

    cursor = new Date(cursor.getFullYear() + 1, 0, 1)
  }

  return buckets
}

export function getAutoAggregateBuckets(fromDate: Date, toDate: Date): Bucket[] {
  const range = normalizeRange(fromDate, toDate)
  const totalDays = diffInDaysInclusive(range.from, range.to)
  const totalMonths = diffInCalendarMonths(range.from, range.to)

  if (totalDays < 14) {
    return buildFixedBuckets(range, 1, (start) => toDayMonth(start))
  }

  if (totalDays <= 30) {
    return buildFixedBuckets(range, 3, (start, end) => `${toDayMonth(start)}-${toDayMonth(end)}`)
  }

  if (totalMonths <= 6) {
    return buildFixedBuckets(range, 7, (start, end) => `${toDayMonth(start)}-${toDayMonth(end)}`)
  }

  if (totalMonths <= 24) {
    return buildMonthlyBuckets(range)
  }

  return buildYearlyBuckets(range)
}

function findBucketIndex(buckets: Bucket[], value: Date): number {
  const time = value.getTime()
  return buckets.findIndex(
    (bucket) => time >= bucket.start.getTime() && time <= bucket.end.getTime()
  )
}

function inRange(value: Date, range: DateRange): boolean {
  return value.getTime() >= range.from.getTime() && value.getTime() <= range.to.getTime()
}

export function bucketTransactions(
  txns: Transaction[],
  buckets: Bucket[],
  type?: TransactionType
): ValuePoint[] {
  const values = buckets.map(() => 0)
  const fullRange = normalizeRange(buckets[0]?.start ?? new Date(), buckets[buckets.length - 1]?.end ?? new Date())

  txns.forEach((tx) => {
    if (type && tx.transaction_type !== type) return
    if (!inRange(tx.transaction_date, fullRange)) return
    const bucketIndex = findBucketIndex(buckets, tx.transaction_date)
    if (bucketIndex < 0) return
    values[bucketIndex] += tx.amount
  })

  return buckets.map((bucket, idx) => ({
    label: bucket.label,
    value: Number(values[idx].toFixed(2)),
  }))
}

export function bucketTransactionsDual(txns: Transaction[], buckets: Bucket[]): IncomeExpensePoint[] {
  const incomeValues = buckets.map(() => 0)
  const expenseValues = buckets.map(() => 0)
  const fullRange = normalizeRange(buckets[0]?.start ?? new Date(), buckets[buckets.length - 1]?.end ?? new Date())

  txns.forEach((tx) => {
    if (!inRange(tx.transaction_date, fullRange)) return
    const bucketIndex = findBucketIndex(buckets, tx.transaction_date)
    if (bucketIndex < 0) return

    if (tx.transaction_type === TransactionType.Deposit) {
      incomeValues[bucketIndex] += tx.amount
      return
    }

    if (tx.transaction_type === TransactionType.Withdraw) {
      expenseValues[bucketIndex] += tx.amount
    }
  })

  return buckets.map((bucket, idx) => ({
    label: bucket.label,
    income: Number(incomeValues[idx].toFixed(2)),
    expense: Number(expenseValues[idx].toFixed(2)),
  }))
}

export function pivotByKey(
  txns: Transaction[],
  buckets: Bucket[],
  keyFn: (tx: Transaction) => string | null | undefined,
  type?: TransactionType
): PivotResult {
  const normalizedKeys = new Set<string>()
  const rows = buckets.map((bucket) => ({ label: bucket.label } as { label: string } & Record<string, number | string>))
  const fullRange = normalizeRange(buckets[0]?.start ?? new Date(), buckets[buckets.length - 1]?.end ?? new Date())

  txns.forEach((tx) => {
    if (type && tx.transaction_type !== type) return
    if (!inRange(tx.transaction_date, fullRange)) return

    const key = keyFn(tx)
    if (!key) return
    normalizedKeys.add(key)

    const rowIndex = findBucketIndex(buckets, tx.transaction_date)
    if (rowIndex < 0) return

    const previous = typeof rows[rowIndex][key] === 'number' ? (rows[rowIndex][key] as number) : 0
    rows[rowIndex][key] = Number((previous + tx.amount).toFixed(2))
  })

  const seriesKeys = Array.from(normalizedKeys).sort((a, b) => a.localeCompare(b))
  rows.forEach((row) => {
    seriesKeys.forEach((key) => {
      if (typeof row[key] !== 'number') {
        row[key] = 0
      }
    })
  })

  return { data: rows, seriesKeys }
}

export const CLASSIFICATION_OPTIONS: Classification[] = [
  Classification.Needs,
  Classification.Wants,
  Classification.Unnecessary,
  Classification.Wasteful,
]
