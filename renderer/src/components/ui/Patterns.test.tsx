import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SegmentedControl, StatusMessage } from './Patterns'

describe('SegmentedControl', () => {
  it('reports the selected value and exposes pressed state', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <SegmentedControl
        ariaLabel="Reporting period"
        value="month"
        onValueChange={onValueChange}
        options={[
          { value: 'month', label: 'Month' },
          { value: 'year', label: 'Year' },
        ]}
      />
    )

    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Year' }))
    expect(onValueChange).toHaveBeenCalledWith('year')
  })
})

describe('StatusMessage', () => {
  it('announces errors and supports dismissal', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()

    render(<StatusMessage tone="error" onDismiss={onDismiss}>Import failed.</StatusMessage>)

    expect(screen.getByRole('alert')).toHaveTextContent('Import failed.')
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
