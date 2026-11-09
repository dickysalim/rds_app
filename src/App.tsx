import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import { LoginForm } from '@/components/LoginForm'
import { NotaPage } from '@/pages/NotaPage'
import { CustomerPage } from '@/pages/CustomerPage'
import { ProductPage } from '@/pages/ProductPage'
import { AliasEditPage } from '@/pages/AliasEditPage'
import { AliasSettingsPage } from '@/pages/AliasSettingsPage'
import { BusinessSettingsPage } from '@/pages/BusinessSettingsPage'
import { ComingSoonPage } from '@/pages/ComingSoonPage'
import { StockManagementPage } from '@/pages/StockManagementPage'
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
          <Route path="/" element={<Navigate to="/nota" replace />} />
          <Route path="/nota" element={<NotaPageRoute />} />
          <Route path="/stock-management" element={<StockManagementPage />} />
          <Route path="/customer" element={<CustomerPage />} />
          <Route path="/product" element={<ProductPage />} />
          <Route path="/revenue" element={<ComingSoonPage title="Revenue" />} />
          <Route path="/expense" element={<ComingSoonPage title="Expense" />} />
          <Route path="/request-expense" element={<ComingSoonPage title="Request Expense" />} />
          <Route path="/report" element={<ComingSoonPage title="Report" />} />
          <Route path="/business-settings" element={<BusinessSettingsPage />} />
          <Route path="/alias-settings" element={<AliasSettingsPage />} />
          <Route path="/alias-settings/new" element={<AliasEditPage />} />
          <Route path="/alias-settings/:id" element={<AliasEditPage />} />
          <Route path="/account-settings" element={<ComingSoonPage title="Account Settings" />} />
          <Route path="/team-settings" element={<ComingSoonPage title="Team Settings" />} />
          {import.meta.env.DEV && <Route path="/dev/pdf-preview" element={<PdfPreviewPage />} />}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
