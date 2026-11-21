import { useEffect, useState } from 'react'
import { LoginForm } from '@/components/LoginForm'
import { EscpLabPage } from '@/pages/EscpLabPage'
import { ForcePasswordChangePage } from '@/pages/ForcePasswordChangePage'
import { fetchCurrentUser, type AuthUser } from '@/lib/auth'
import { getToken, setUsingStagingDb } from '@/lib/api'

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checking, setChecking] = useState(true)
  const [loginPassword, setLoginPassword] = useState<string | null>(null)

  useEffect(() => {
    // Lab always samples the staging DB (only takes effect for super_admin).
    setUsingStagingDb(true)
    if (!getToken()) {
      setChecking(false)
      return
    }
    fetchCurrentUser()
      .then(setUser)
      .finally(() => setChecking(false))
  }, [])

  if (checking) return null

  if (!user) {
    return (
      <LoginForm
        onLogin={(loggedInUser, password) => {
          setUser(loggedInUser)
          setLoginPassword(password)
        }}
      />
    )
  }

  if (user.must_change_password) {
    return (
      <ForcePasswordChangePage
        knownCurrentPassword={loginPassword}
        onDone={(updated) => {
          setUser(updated)
          setLoginPassword(null)
        }}
      />
    )
  }

  return <EscpLabPage />
}

export default App
