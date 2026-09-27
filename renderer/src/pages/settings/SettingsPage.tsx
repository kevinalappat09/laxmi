import { Card } from '../../components/ui/Card'
import './SettingsPage.css'

export type Appearance = 'solid' | 'glass'

interface SettingsPageProps {
  appearance: Appearance
  onAppearanceChange: (appearance: Appearance) => Promise<void>
}

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

export function SettingsPage({ appearance, onAppearanceChange }: SettingsPageProps) {
  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <h1>Settings</h1>
        <p>Customize how Laxmi looks on this device.</p>
      </header>

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
    </div>
  )
}
