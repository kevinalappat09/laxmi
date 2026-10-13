import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountSubType, AccountType, type Account } from '../../../../src/types/account'
import type { CreditCardSummary } from '../../../../src/types/creditCard'
import { NavigationProvider } from '../../contexts/NavigationContext'
import { HomePage } from './HomePage'

describe('HomePage credit account card', () => {
  beforeEach(() => {
    const account: Account = {
      account_id: 7,
      institution_name: 'Example Bank',
      account_name: 'Visa',
      account_type: AccountType.Liability,
      sub_type: AccountSubType.Credit,
      color: '#3498DB',
      opened_on: new Date('2024-01-01'),
      created_on: new Date('2024-01-01'),
      modified_on: new Date('2024-01-01'),
      is_active: true,
      metadata: null,
    }
    const summary: CreditCardSummary = {
      account,
      details: {
        account_id: 7,
        credit_limit: 100000,
        statement_day: 10,
        payment_due_day: 25,
        utilization_alert_threshold: 0.05,
        statement_reminder_lead_days: 5,
        payment_reminder_lead_days: 5,
        created_on: new Date('2024-01-01'),
        modified_on: new Date('2024-01-01'),
      },
      outstanding: 12345,
      available: 87655,
      utilization: 0.12345,
      next_statement_date: new Date('2024-02-10'),
      next_due_date: new Date('2024-02-25'),
    }

    Object.defineProperty(window, 'financeAPI', {
      configurable: true,
      value: {
        listActiveAccounts: vi.fn().mockResolvedValue([account]),
        listCreditCardSummaries: vi.fn().mockResolvedValue([summary]),
        findTransactionsWithFilter: vi.fn().mockResolvedValue([]),
        getTransactionsAffectingAccount: vi.fn(),
        getBudgetNotifications: vi.fn().mockResolvedValue([]),
        getUpcomingRecurring: vi.fn().mockResolvedValue([]),
        getCreditCardNotifications: vi.fn().mockResolvedValue([]),
      } as unknown as IFinanceAPI,
    })
  })

  it('shows utilized credit as the primary amount and the limit as supporting text', async () => {
    render(
      <NavigationProvider>
        <HomePage currentProfile="Test" onSwitchProfile={() => undefined} />
      </NavigationProvider>
    )

    expect(await screen.findByRole('button', { name: 'Open Visa account' })).toBeInTheDocument()
    expect(screen.getByText('Utilized')).toBeInTheDocument()
    expect(screen.getByText('₹12,345.00')).toBeInTheDocument()
    expect(screen.getByText('Limit ₹1,00,000.00')).toBeInTheDocument()
    expect(window.financeAPI.getTransactionsAffectingAccount).not.toHaveBeenCalled()
  })
})
