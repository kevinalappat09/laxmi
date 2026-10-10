import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox } from './Checkbox'
import { Button } from './Button'

describe('Checkbox', () => {
  it('reports checked state changes with an accessible label', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<Checkbox id="pending" label="Include pending" onCheckedChange={onCheckedChange} />)

    await user.click(screen.getByRole('checkbox', { name: 'Include pending' }))

    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })
})

describe('Button', () => {
  it('uses the canonical primary action class', () => {
    render(<Button variant="primary">Add category</Button>)
    expect(screen.getByRole('button', { name: 'Add category' })).toHaveClass('ui-button--variant-primary')
  })
})
