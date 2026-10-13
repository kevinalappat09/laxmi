import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RadioGroup } from './RadioGroup'

describe('RadioGroup variants', () => {
  it('supports keyboard selection for card options', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <RadioGroup
        label="Theme"
        variant="cards"
        name="theme"
        defaultValue="dark"
        onValueChange={onValueChange}
        options={[
          { value: 'dark', label: 'Dark', description: 'Dim surfaces' },
          { value: 'light', label: 'Light', description: 'Bright surfaces' },
        ]}
      />
    )

    await user.tab()
    expect(screen.getByRole('radio', { name: /Dark/ })).toHaveFocus()
    screen.getByRole('radio', { name: /Light/ }).focus()
    await user.keyboard(' ')
    expect(onValueChange).toHaveBeenCalledWith('light')
    expect(screen.getByRole('radio', { name: /Light/ })).toHaveFocus()
  })

  it('keeps hidden-label swatches named and disabled states unavailable', () => {
    render(
      <RadioGroup
        label="Account color"
        hideLabel
        variant="swatches"
        name="color"
        defaultValue="blue"
        options={[
          { value: 'blue', label: 'Blue', visual: <span aria-hidden /> },
          { value: 'gray', label: 'Gray', disabled: true, visual: <span aria-hidden /> },
        ]}
      />
    )

    expect(screen.getByRole('group', { name: 'Account color' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Blue' })).toBeChecked()
    const disabledSwatch = screen.getByRole('radio', { name: 'Gray' })
    expect(disabledSwatch).toBeDisabled()
    expect(disabledSwatch.closest('label')).toHaveClass('ui-radio-group__option--disabled')
  })
})
