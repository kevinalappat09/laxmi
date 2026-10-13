import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MultiSelectDropdown } from './MultiSelectDropdown'

afterEach(cleanup)

describe('MultiSelectDropdown', () => {
  it('filters searchable options and preserves selection behavior', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <MultiSelectDropdown
        id="categories"
        label="Categories"
        options={[
          { value: 'rent', label: 'Housing / Rent' },
          { value: 'groceries', label: 'Food / Groceries' },
          { value: 'fuel', label: 'Transport / Fuel' },
        ]}
        value={[]}
        onValueChange={onValueChange}
        searchable
        searchPlaceholder="Search categories"
      />
    )

    await user.click(screen.getByRole('button', { name: 'Categories' }))
    const search = screen.getByRole('searchbox', { name: 'Search Categories' })
    expect(search).toHaveFocus()

    await user.type(search, 'rent')
    expect(screen.getByRole('status')).toHaveTextContent('1 matching option')
    expect(screen.getByRole('checkbox', { name: 'Housing / Rent' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Food / Groceries' })).not.toBeInTheDocument()

    await user.tab()
    expect(screen.getByRole('checkbox', { name: 'Housing / Rent' })).toHaveFocus()
    await user.keyboard(' ')
    expect(onValueChange).toHaveBeenCalledWith(['rent'])

    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Categories' })).toHaveFocus()
  })

  it('shows a no-match state', async () => {
    const user = userEvent.setup()

    render(
      <MultiSelectDropdown
        id="categories-empty-search"
        label="Categories"
        options={[{ value: 'rent', label: 'Housing / Rent' }]}
        value={[]}
        onValueChange={() => undefined}
        searchable
      />
    )

    await user.click(screen.getByRole('button', { name: 'Categories' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search Categories' }), 'medical')
    expect(screen.getByText('No matching options')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('0 matching options')
  })

  it('clears search when a controlled picker is externally closed', async () => {
    const user = userEvent.setup()

    function ControlledPicker() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setOpen(false)}>Close picker</button>
          <button type="button" onClick={() => setOpen(true)}>Reopen picker</button>
          <MultiSelectDropdown
            id="controlled-categories"
            label="Categories"
            options={[
              { value: 'rent', label: 'Housing / Rent' },
              { value: 'groceries', label: 'Food / Groceries' },
            ]}
            value={[]}
            onValueChange={() => undefined}
            open={open}
            onOpenChange={setOpen}
            searchable
          />
        </>
      )
    }

    render(<ControlledPicker />)
    const search = screen.getByRole('searchbox', { name: 'Search Categories' })
    await user.type(search, 'rent')
    await user.click(screen.getByRole('button', { name: 'Close picker' }))
    expect(screen.queryByRole('searchbox', { name: 'Search Categories' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reopen picker' }))
    expect(screen.getByRole('searchbox', { name: 'Search Categories' })).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: 'Food / Groceries' })).toBeInTheDocument()
  })
})
