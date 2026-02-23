import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [currentProfile, setCurrentProfile] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSelectionDialog, setShowSelectionDialog] = useState(false)

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
          setIsLoading(false)
        } else {
          setShowSelectionDialog(true)
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (currentProfile) {
    return <div>Hello {currentProfile}</div>
  }

  if (showSelectionDialog) {
    return <div>Profile Selection Dialog Placeholder</div>
  }

  return (
    <div>Unexpected state</div>
  )
}

export default App
