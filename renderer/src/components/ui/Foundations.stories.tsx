import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Checkbox } from './Checkbox'
import { Popover } from './Popover'
import { RadioGroup } from './RadioGroup'
import { Select } from './Input'
import { Switch } from './Switch'
import { Tabs } from './Tabs'
import { Textarea } from './Textarea'

const meta = {
  title: 'Design system/Foundations',
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function CanonicalControlsStory() {
  const [checked, setChecked] = useState(true)
  const [notifications, setNotifications] = useState(false)
  const [density, setDensity] = useState('comfortable')

  return (
    <Card style={{ width: 520, display: 'grid', gap: 'var(--spacing-20)' }}>
      <div style={{ display: 'flex', gap: 'var(--spacing-8)', flexWrap: 'wrap' }}>
        <Button variant="primary">Primary action</Button>
        <Button>Secondary action</Button>
        <Popover trigger={<Button variant="subtle">Open popover</Button>}>
          Reusable overlay content
        </Popover>
      </div>
      <Checkbox id="story-checkbox" label="Include pending transactions" checked={checked} onCheckedChange={(value) => setChecked(value === true)} />
      <Switch id="story-switch" label="Budget notifications" checked={notifications} onCheckedChange={setNotifications} />
      <RadioGroup
        label="Density"
        name="density"
        value={density}
        onValueChange={setDensity}
        options={[
          { value: 'comfortable', label: 'Comfortable' },
          { value: 'compact', label: 'Compact' },
        ]}
      />
      <Textarea id="story-notes" label="Notes" placeholder="Add context" />
      <Select id="story-account" label="Account" defaultValue="checking">
        <option value="checking">Kotak Checking Account</option>
        <option value="savings">Savings Account</option>
      </Select>
      <Tabs
        ariaLabel="Account summary"
        defaultValue="balance"
        items={[
          { value: 'balance', label: 'Balance', content: '₹167,790.20' },
          { value: 'activity', label: 'Activity', content: 'Recent transactions' },
        ]}
      />
    </Card>
  )
}

export const CanonicalControls: Story = {
  render: () => <CanonicalControlsStory />,
}
