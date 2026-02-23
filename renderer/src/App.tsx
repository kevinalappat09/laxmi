import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [currentProfile, setCurrentProfile] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSelectionDialog, setShowSelectionDialog] = useState(false)
  const [profiles, setProfiles] = useState<string[]>([])
  const [newProfileName, setNewProfileName] = useState('')

  const handleOpenProfile = async (name: string) => {
    await window.financeAPI.openProfile(name)
    setCurrentProfile(name)
    setShowSelectionDialog(false)
    setIsLoading(false)
  }

  useEffect(() => {
    let isMounted = true

    window.financeAPI.getLastOpenedProfile().then(async (profileName) => {
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

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="app-root">
      {isLoading && <div>Loading...</div>}

      {!isLoading && currentProfile && <div>Hello {currentProfile}</div>}

      {!isLoading && !currentProfile && showSelectionDialog && (
        <div className="profile-selection">
          <h1>Profile Selection</h1>

          <div className="profile-list">
            <h2>Existing Profiles</h2>
            {profiles.length === 0 ? (
              <div>No profiles found.</div>
            ) : (
              <ul>
                {profiles.map((name) => (
                  <li
                    key={name}
                    onDoubleClick={() => handleOpenProfile(name)}
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
                await window.financeAPI.createProfile(trimmed)
                await handleOpenProfile(trimmed)
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
