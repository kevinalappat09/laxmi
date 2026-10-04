import { Card } from '../../components/ui/Card'
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
      <header className="settings-page__header">
        <h1>Settings</h1>
        <p>Customize how Laxmi looks on this device.</p>
      </header>

      <Card className="settings-page__section">
        <div className="settings-page__section-heading">
          <h2>Theme</h2>
          <p>Choose the color theme used throughout Laxmi.</p>
        </div>

        <div className="settings-page__options" role="radiogroup" aria-label="Theme">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              className={`settings-page__option${theme === option.value ? ' settings-page__option--selected' : ''}`}
              onClick={() => void onThemeChange(option.value)}
            >
              <span className="settings-page__option-indicator" aria-hidden="true" />
              <span>
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="settings-page__section">
        <div className="settings-page__section-heading">
          <h2>Appearance</h2>
          <p>Choose between the standard opaque interface and restrained desktop glass.</p>
        </div>

        <div className="settings-page__options" role="radiogroup" aria-label="Appearance">
          {appearanceOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={appearance === option.value}
              className={`settings-page__option${appearance === option.value ? ' settings-page__option--selected' : ''}`}
              onClick={() => void onAppearanceChange(option.value)}
            >
              <span className="settings-page__option-indicator" aria-hidden="true" />
              <span>
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="settings-page__section">
        <div className="settings-page__section-heading">
          <h2>Text size</h2>
          <p>Increase text on pages, tables, and charts.</p>
        </div>

        <div className="settings-page__options" role="radiogroup" aria-label="Text size">
          {textSizeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={textSize === option.value}
              className={`settings-page__option${textSize === option.value ? ' settings-page__option--selected' : ''}`}
              onClick={() => void onTextSizeChange(option.value)}
            >
              <span className="settings-page__option-indicator" aria-hidden="true" />
              <span>
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
