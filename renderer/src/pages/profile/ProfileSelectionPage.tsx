import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import './ProfileSelectionPage.css'

interface ProfileSelectionPageProps {
  profiles: string[]
  newProfileName: string
  error: string | null
  onProfileNameChange: (value: string) => void
  onOpenProfile: (name: string) => void
  onCreateProfile: () => void
}

export function ProfileSelectionPage({
  profiles,
  newProfileName,
  error,
  onProfileNameChange,
  onOpenProfile,
  onCreateProfile
}: ProfileSelectionPageProps) {
  return (
    <div className="profile-page">
      <div className="profile-page__container">
        <h1 className="profile-page__title">Select a Profile</h1>
        {error && <p className="profile-page__error">{error}</p>}
        <div className="profile-page__grid">
          <Card className="profile-page__card">
            <h2>Existing Profiles</h2>
            {profiles.length === 0 ? (
              <p className="profile-page__empty">No profiles found.</p>
            ) : (
              <ul className="profile-page__list">
                {profiles.map((name) => (
                  <li key={name}>
                    <Button variant="subtle" className="profile-page__profile-btn" onClick={() => onOpenProfile(name)}>
                      {name}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="profile-page__card">
            <h2>Create New Profile</h2>
            <Input
              id="new-profile-name"
              label="Profile name"
              value={newProfileName}
              onChange={(event) => onProfileNameChange(event.target.value)}
              placeholder="Profile name"
            />
            <Button variant="pill" className="profile-page__create-btn" onClick={onCreateProfile}>
              Create Profile
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
