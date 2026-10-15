import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/AppSidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import type { AuthUser } from '@/lib/auth'
import { NavGuardProvider } from '@/lib/nav-guard'

export function AppLayout({
  user,
  onLogout,
}: {
  user: AuthUser
  onLogout: () => void
}) {
  return (
    <NavGuardProvider>
      <SidebarProvider>
        <AppSidebar user={user} onLogout={onLogout} />
        <div className="flex min-h-svh w-full flex-col">
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </SidebarProvider>
    </NavGuardProvider>
  )
}
