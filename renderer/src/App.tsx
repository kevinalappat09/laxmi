import { useEffect, useState } from 'react'
import './App.css'

function MainHome({
  currentProfile,
  onSwitchProfile,
}: {
  currentProfile: string
  onSwitchProfile: () => void
}) {
  const environment = import.meta.env.MODE

  return (
    <div className="main-home">
      <h1>Welcome back, {currentProfile}!</h1>
      <button onClick={onSwitchProfile}>Logout/Switch Profile</button>
      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
        Environment: {environment}
      </div>
    </div>
  )
}

function App() {
  const [currentProfile, setCurrentProfile] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSelectionDialog, setShowSelectionDialog] = useState(false)
  const [profiles, setProfiles] = useState<string[]>([])
  const [newProfileName, setNewProfileName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleOpenProfile = async (name: string) => {
    setIsLoading(true)
    setError(null)

    try {
      await window.financeAPI.openProfile(name)
      setCurrentProfile(name)
      setShowSelectionDialog(false)
    } catch (e) {
      console.error(e)
      setError('Failed to open profile.')
      setShowSelectionDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwitchProfile = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const existingProfiles = await window.financeAPI.listProfiles()
      setProfiles(existingProfiles)
      setCurrentProfile(null)
      setShowSelectionDialog(true)
    } catch (e) {
      console.error(e)
      setError('Failed to load profiles.')
      setShowSelectionDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    window.financeAPI
      .getLastOpenedProfile()
      .then(async (profileName) => {
        if (!isMounted) return

        if (profileName) {
          await window.financeAPI.openProfile(profileName)
          if (!isMounted) return
          setCurrentProfile(profileName)
          setShowSelectionDialog(false)
          setIsLoading(false)
        } else {
          const existingProfiles = await window.financeAPI.listProfiles()
          if (!isMounted) return
          setProfiles(existingProfiles)
          setShowSelectionDialog(true)
          setIsLoading(false)
        }
      })
      .catch(() => {
        if (!isMounted) return
        setShowSelectionDialog(true)
        setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="app-root">
      {isLoading && <div>Loading...</div>}

      {!isLoading && currentProfile && (
        <MainHome
          currentProfile={currentProfile}
          onSwitchProfile={handleSwitchProfile}
        />
      )}

      {!isLoading && !currentProfile && showSelectionDialog && (
        <div className="profile-selection">
          <h1>Profile Selection</h1>

          <div className="profile-list">
            <h2>Existing Profiles</h2>
            {error && (
              <div style={{ color: 'red', marginBottom: '0.5rem' }}>
                {error}
              </div>
            )}
            {profiles.length === 0 ? (
              <div>No profiles found.</div>
            ) : (
              <ul>
                {profiles.map((name) => (
                  <li
                    key={name}
                    onClick={() => handleOpenProfile(name)}
                    style={{ cursor: 'pointer', padding: '0.5rem 0' }}
                  >
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="profile-create">
            <h2>Create New Profile</h2>
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Profile name"
            />
            <button
              onClick={async () => {
                const trimmed = newProfileName.trim()
                if (!trimmed) return
                setError(null)
                try {
                  await window.financeAPI.createProfile(trimmed)
                  await handleOpenProfile(trimmed)
                } catch (e) {
                  console.error(e)
                  setError('Failed to create profile.')
                }
              }}
            >
              Create Profile
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
