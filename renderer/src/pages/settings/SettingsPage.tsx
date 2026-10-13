import { PageHeader, Panel, RadioGroup } from '../../components/ui'
import { CategorySettings } from './CategorySettings'
import './SettingsPage.css'

export type Appearance = 'solid' | 'glass'
export type Theme = 'dark' | 'light'
export type TextSize = 'default' | 'large' | 'larger'

interface SettingsPageProps {
  theme: Theme
  onThemeChange: (theme: Theme) => Promise<void>
  appearance: Appearance
  onAppearanceChange: (appearance: Appearance) => Promise<void>
  textSize: TextSize
  onTextSizeChange: (textSize: TextSize) => Promise<void>
}

const themeOptions: Array<{
  value: Theme
  title: string
  description: string
}> = [
  {
    value: 'dark',
    title: 'Dark',
    description: 'A low-light interface with bright financial indicators.',
  },
  {
    value: 'light',
    title: 'Light',
    description: 'A bright interface with clear contrast for daytime use.',
  },
]

const appearanceOptions: Array<{
  value: Appearance
  title: string
  description: string
}> = [
  {
    value: 'solid',
    title: 'Solid',
    description: 'Maximum contrast with fully opaque application surfaces.',
  },
  {
    value: 'glass',
    title: 'Glass',
    description: 'Subtle wallpaper translucency while keeping financial data readable.',
  },
]

const textSizeOptions: Array<{
  value: TextSize
  title: string
  description: string
}> = [
  {
    value: 'default',
    title: 'Default',
    description: 'The standard text size for pages, tables, and charts.',
  },
  {
    value: 'large',
    title: 'Large',
    description: 'A larger text size across pages, tables, and charts.',
  },
  {
    value: 'larger',
    title: 'Larger',
    description: 'The largest text size across pages, tables, and charts.',
  },
]

export function SettingsPage({
  theme,
  onThemeChange,
  appearance,
  onAppearanceChange,
  textSize,
  onTextSizeChange,
}: SettingsPageProps) {
  return (
    <div className="settings-page">
      <PageHeader title="Settings" description="Manage your categories and customize how Laxmi looks on this device." />

      <Panel className="settings-page__section" title="Categories" description="Create nested categories or update the categories used throughout Laxmi.">
        <CategorySettings />
      </Panel>

      <Panel className="settings-page__section" title="Theme" description="Choose the color theme used throughout Laxmi.">
        <RadioGroup label="Theme" hideLabel variant="cards" name="theme" value={theme} onValueChange={(value) => void onThemeChange(value as Theme)} options={themeOptions.map((option) => ({ value: option.value, label: option.title, description: option.description }))} />
      </Panel>

      <Panel className="settings-page__section" title="Appearance" description="Choose between the standard opaque interface and restrained desktop glass.">
        <RadioGroup label="Appearance" hideLabel variant="cards" name="appearance" value={appearance} onValueChange={(value) => void onAppearanceChange(value as Appearance)} options={appearanceOptions.map((option) => ({ value: option.value, label: option.title, description: option.description }))} />
      </Panel>

      <Panel className="settings-page__section" title="Text size" description="Increase text on pages, tables, and charts.">
        <RadioGroup label="Text size" hideLabel variant="cards" name="text-size" value={textSize} onValueChange={(value) => void onTextSizeChange(value as TextSize)} options={textSizeOptions.map((option) => ({ value: option.value, label: option.title, description: option.description }))} />
      </Panel>
    </div>
  )
}
