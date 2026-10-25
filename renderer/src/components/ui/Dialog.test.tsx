import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'
import { CSVImportDialog } from '../../pages/importexport/CSVImportDialog'

const dialogStyles = readFileSync('src/components/ui/Dialog.css', 'utf8')
const importStyles = readFileSync('src/pages/importexport/CSVImportDialog.css', 'utf8')
const paletteStyles = readFileSync('src/components/CommandPalette.css', 'utf8')

describe('Dialog', () => {
  it('closes on Escape and exposes its title', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Dialog open title="Edit account" onOpenChange={onOpenChange}><button>Save</button></Dialog>)

    expect(screen.getByRole('dialog', { name: 'Edit account' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it.each([
    ['palette styles first', `${paletteStyles}\n${dialogStyles}\n${importStyles}`],
    ['palette styles last (production)', `${dialogStyles}\n${importStyles}\n${paletteStyles}`],
  ])('keeps the import dialog above its blurred backdrop with %s', async (_, css) => {
    // Vitest does not apply imported CSS, so install the actual styles explicitly.
    const style = document.createElement('style')
    style.textContent = css
    document.head.append(style)
    const onClose = vi.fn()
    const view = render(<CSVImportDialog accounts={[]} onClose={onClose} />)

    try {
      const panel = screen.getByRole('dialog', { name: 'Import Transactions from CSV' })
      const overlay = document.querySelector('.ui-dialog__overlay')!
      expect(Number(getComputedStyle(panel).zIndex)).toBeGreaterThan(
        Number(getComputedStyle(overlay).zIndex),
      )
      await userEvent.setup().click(screen.getByRole('button', { name: 'Close dialog' }))
      expect(onClose).toHaveBeenCalledOnce()
    } finally {
      view.unmount()
      style.remove()
    }
  })
})
