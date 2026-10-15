import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import { LoginForm } from '@/components/LoginForm'
import { HomePage } from '@/pages/HomePage'
import { NotaPage } from '@/pages/NotaPage'
import { CustomerPage } from '@/pages/CustomerPage'
import { ProductPage } from '@/pages/ProductPage'
import { BusinessSettingsPage } from '@/pages/BusinessSettingsPage'
import { PdfPreviewPage } from '@/pages/dev/PdfPreviewPage'
import { fetchCurrentUser, logout, type AuthUser } from '@/lib/auth'
import { getToken } from '@/lib/api'

function NotaPageRoute() {
  const location = useLocation()
  return <NotaPage key={location.key} />
}

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
          <Route path="/nota" element={<NotaPageRoute />} />
          <Route path="/customer" element={<CustomerPage />} />
          <Route path="/product" element={<ProductPage />} />
          <Route path="/business-settings" element={<BusinessSettingsPage />} />
          {import.meta.env.DEV && <Route path="/dev/pdf-preview" element={<PdfPreviewPage />} />}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
