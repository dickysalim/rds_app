import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import { LoginForm } from '@/components/LoginForm'
import { HomePage } from '@/pages/HomePage'
import { NotaPage } from '@/pages/NotaPage'
import { CustomerPage } from '@/pages/CustomerPage'
import { ProductPage } from '@/pages/ProductPage'
import { fetchCurrentUser, logout, type AuthUser } from '@/lib/auth'
import { getToken } from '@/lib/api'

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
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
    return <LoginForm onLogin={setUser} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <AppLayout
              user={user}
              onLogout={() => {
                logout()
                setUser(null)
              }}
            />
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route path="/nota" element={<NotaPage />} />
          <Route path="/customer" element={<CustomerPage />} />
          <Route path="/product" element={<ProductPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
