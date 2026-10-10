import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

describe('Dialog', () => {
  it('closes on Escape and exposes its title', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Dialog open title="Edit account" onOpenChange={onOpenChange}><button>Save</button></Dialog>)

    expect(screen.getByRole('dialog', { name: 'Edit account' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
