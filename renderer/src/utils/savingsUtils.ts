import type { PortfolioTransaction } from '../../../src/types/portfolioTransaction'
import { TransactionType, type Transaction } from '../../../src/types/transaction'
import type { Bucket } from './chartUtils'

export interface SavingsSummary {
  /** Raw deposits before backing out returned investment capital. */
  grossIncome: number
  /** Raw withdrawals before backing out money moved into investments. */
  grossExpense: number
  investmentOutflow: number
  capitalReturned: number
  income: number
  expense: number
  netSavings: number
  /** Percentage points (0-100), or null when there is no income to divide by. */
  savingsRate: number | null
}

export interface SavingsPoint extends SavingsSummary {
  label: string
}

/**
 * Mirrors buildLaxmiTransaction in portfolioTransactionService, which is what actually
 * writes the bank-side leg. A portfolio transaction with no sourceAccountId never touched
 * a Laxmi account, so it has nothing to reverse out.
 *
 * Cash dividends are deliberately absent: they are genuine income, not returned capital.
 */
function getBankLeg(entry: PortfolioTransaction): { direction: 'out' | 'in'; amount: number } | null {
  if (entry.sourceAccountId == null) return null

  const gross = entry.quantity * entry.pricePerUnit

  if (entry.transactionType === 'BUY' || entry.transactionType === 'SIP') {
    return { direction: 'out', amount: gross + entry.fees + entry.taxes }
  }

  if (entry.transactionType === 'SELL' || entry.transactionType === 'REDEMPTION') {
    return { direction: 'in', amount: gross - entry.fees - entry.taxes }
  }

  return null
}

/** Portfolio dates are stored as plain YYYY-MM-DD, so parse to local midnight rather than UTC. */
export function parsePortfolioDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function filterPortfolioTransactionsByRange(
  entries: PortfolioTransaction[],
  fromDate: Date,
  toDate: Date
): PortfolioTransaction[] {
  const from = fromDate.getTime()
  const to = toDate.getTime()

  return entries.filter((entry) => {
    const time = parsePortfolioDate(entry.transactionDate).getTime()
    return time >= from && time <= to
  })
}

function round(value: number): number {
  return Number(value.toFixed(2))
}

function buildSummary(
  grossIncome: number,
  grossExpense: number,
  investmentOutflow: number,
  capitalReturned: number
): SavingsSummary {
  // Clamped because a portfolio entry can outlive the bank transaction it created,
  // which would otherwise produce a negative expense.
  const expense = Math.max(0, grossExpense - investmentOutflow)
  const income = Math.max(0, grossIncome - capitalReturned)
  const netSavings = income - expense

  return {
    grossIncome: round(grossIncome),
    grossExpense: round(grossExpense),
    investmentOutflow: round(investmentOutflow),
    capitalReturned: round(capitalReturned),
    income: round(income),
    expense: round(expense),
    netSavings: round(netSavings),
    savingsRate: income > 0 ? round((netSavings / income) * 100) : null,
  }
}

export function computeSavings(
  transactions: Transaction[],
  portfolioTransactions: PortfolioTransaction[]
): SavingsSummary {
  let grossIncome = 0
  let grossExpense = 0

  transactions.forEach((tx) => {
    if (tx.transaction_type === TransactionType.Deposit) {
      grossIncome += tx.amount
      return
    }
    if (tx.transaction_type === TransactionType.Withdraw) {
      grossExpense += tx.amount
    }
  })

  let investmentOutflow = 0
  let capitalReturned = 0

  portfolioTransactions.forEach((entry) => {
    const leg = getBankLeg(entry)
    if (!leg) return

    if (leg.direction === 'out') {
      investmentOutflow += leg.amount
      return
    }
    capitalReturned += leg.amount
  })

  return buildSummary(grossIncome, grossExpense, investmentOutflow, capitalReturned)
}

function findBucketIndex(buckets: Bucket[], value: Date): number {
  const time = value.getTime()
  return buckets.findIndex((bucket) => time >= bucket.start.getTime() && time <= bucket.end.getTime())
}

export function bucketSavings(
  transactions: Transaction[],
  portfolioTransactions: PortfolioTransaction[],
  buckets: Bucket[]
): SavingsPoint[] {
  const grossIncome = buckets.map(() => 0)
  const grossExpense = buckets.map(() => 0)
  const investmentOutflow = buckets.map(() => 0)
  const capitalReturned = buckets.map(() => 0)

  transactions.forEach((tx) => {
    const index = findBucketIndex(buckets, new Date(tx.transaction_date))
    if (index < 0) return

    if (tx.transaction_type === TransactionType.Deposit) {
      grossIncome[index] += tx.amount
      return
    }
    if (tx.transaction_type === TransactionType.Withdraw) {
      grossExpense[index] += tx.amount
    }
  })

  portfolioTransactions.forEach((entry) => {
    const leg = getBankLeg(entry)
    if (!leg) return

    const index = findBucketIndex(buckets, parsePortfolioDate(entry.transactionDate))
    if (index < 0) return

    if (leg.direction === 'out') {
      investmentOutflow[index] += leg.amount
      return
    }
    capitalReturned[index] += leg.amount
  })

  return buckets.map((bucket, index) => ({
    label: bucket.label,
    ...buildSummary(
      grossIncome[index],
      grossExpense[index],
      investmentOutflow[index],
      capitalReturned[index]
    ),
  }))
}
