import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AppSidebar } from '@/components/AppSidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import type { AuthUser } from '@/lib/auth'
import { isPathAllowed } from '@/lib/access'
import { NavGuardProvider } from '@/lib/nav-guard'

export interface AppOutletContext {
  user: AuthUser
  onUserUpdate: (user: AuthUser) => void
}

export function AppLayout({
  user,
  onLogout,
  onUserUpdate,
}: {
  user: AuthUser
  onLogout: () => void
  onUserUpdate: (user: AuthUser) => void
}) {
  const location = useLocation()

  if (!isPathAllowed(user.role, location.pathname)) {
    return <Navigate to="/stock-management" replace />
  }

  return (
    <NavGuardProvider>
      <SidebarProvider>
        <AppSidebar user={user} onLogout={onLogout} />
        <div className="flex min-h-svh w-full min-w-0 flex-col">
          <main className="min-w-0 flex-1 p-6">
            <Outlet context={{ user, onUserUpdate } satisfies AppOutletContext} />
          </main>
        </div>
      </SidebarProvider>
    </NavGuardProvider>
  )
}
