import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Checkbox } from './Checkbox'
import { Popover } from './Popover'
import { EmptyState, Metric, PageHeader, Panel, SegmentedControl, StatusMessage, TableContainer } from './Patterns'
import { MultiSelectDropdown } from './MultiSelectDropdown'
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
  const [categories, setCategories] = useState<string[]>([])

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
      <MultiSelectDropdown
        id="story-categories"
        label="Categories"
        options={[
          { value: 'housing-rent', label: 'Housing / Rent' },
          { value: 'food-groceries', label: 'Food / Groceries' },
          { value: 'transport-fuel', label: 'Transport / Fuel' },
        ]}
        value={categories}
        onValueChange={setCategories}
        placeholder="All categories"
        searchable
        searchPlaceholder="Search categories"
      />
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

function PagePatternsStory() {
  const [period, setPeriod] = useState('month')

  return (
    <div style={{ display: 'grid', gap: 'var(--spacing-20)' }}>
      <PageHeader
        title="Portfolio"
        description="Track holdings and performance."
        actions={<Button variant="pill">+ Add transaction</Button>}
      />
      <SegmentedControl
        ariaLabel="Reporting period"
        value={period}
        onValueChange={setPeriod}
        options={[
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
          { value: 'year', label: 'Year' },
        ]}
      />
      <StatusMessage tone="success">Prices updated successfully.</StatusMessage>
      <Panel title="Summary" description="Current portfolio value">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-16)' }}>
          <Metric label="Invested" value="₹125,000" />
          <Metric label="Current value" value="₹138,240" tone="positive" />
          <Metric label="Gain/loss" value="+₹13,240" detail="+10.59%" tone="positive" />
        </div>
      </Panel>
      <TableContainer>
        <table style={{ width: '100%' }}>
          <thead><tr><th>Asset</th><th>Value</th></tr></thead>
          <tbody><tr><td>Index fund</td><td>₹138,240</td></tr></tbody>
        </table>
      </TableContainer>
      <EmptyState title="No transactions yet" description="Add a transaction to start tracking this account." action={<Button variant="pill">Add transaction</Button>} />
    </div>
  )
}

export const PagePatterns: Story = {
  render: () => <PagePatternsStory />,
}

function RadioVariantsStory() {
  const [theme, setTheme] = useState('dark')
  const [color, setColor] = useState('blue')
  const colorOptions = [
    { value: 'blue', label: 'Blue', visual: <span aria-hidden style={{ width: 28, height: 28, borderRadius: 'var(--radius-round)', background: 'var(--color-cosmic-blue)' }} /> },
    { value: 'green', label: 'Green', visual: <span aria-hidden style={{ width: 28, height: 28, borderRadius: 'var(--radius-round)', background: 'var(--color-positive)' }} /> },
    { value: 'unavailable', label: 'Unavailable', disabled: true, visual: <span aria-hidden style={{ width: 28, height: 28, borderRadius: 'var(--radius-round)', background: 'var(--color-text-muted)' }} /> },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(320px, 1fr))', gap: 'var(--spacing-20)' }}>
      {(['dark', 'light'] as const).map((appearance) => (
        <Card key={appearance} data-theme={appearance} data-appearance="solid" style={{ display: 'grid', gap: 'var(--spacing-20)', background: 'var(--color-bg-card)' }}>
          <strong style={{ color: 'var(--color-text-heading)' }}>{appearance === 'dark' ? 'Dark theme' : 'Light theme'}</strong>
          <RadioGroup
            label="Application theme"
            variant="cards"
            name={`theme-${appearance}`}
            value={theme}
            onValueChange={setTheme}
            options={[
              { value: 'dark', label: 'Dark', description: 'Reduced glare for dim environments.' },
              { value: 'light', label: 'Light', description: 'Bright surfaces and dark text.' },
              { value: 'system', label: 'System', description: 'Unavailable in this preview.', disabled: true },
            ]}
          />
          <RadioGroup
            label="Account color"
            hideLabel
            variant="swatches"
            name={`color-${appearance}`}
            value={color}
            onValueChange={setColor}
            options={colorOptions}
          />
        </Card>
      ))}
    </div>
  )
}

export const RadioVariants: Story = {
  render: () => <RadioVariantsStory />,
}
