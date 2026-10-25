import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { CSVImportDialog } from '../../pages/importexport/CSVImportDialog'
import { Button } from './Button'
// The app loads these styles globally, even while the palette is closed.
import '../CommandPalette.css'

const meta = {
  title: 'Design system/Dialog',
  parameters: { layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function ImportTransactionsStory() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Import Transactions</Button>
      {open && <CSVImportDialog accounts={[]} onClose={() => setOpen(false)} />}
    </>
  )
}

export const ImportTransactions: Story = {
  render: () => <ImportTransactionsStory />,
}
