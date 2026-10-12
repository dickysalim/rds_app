import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/AppSidebar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import type { AuthUser } from '@/lib/auth'

export function AppLayout({
  user,
  onLogout,
}: {
  user: AuthUser
  onLogout: () => void
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex min-h-svh w-full flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm text-muted-foreground">
              Signed in as {user.name} <Badge variant="secondary">{user.role}</Badge>
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={onLogout}>
            Sign out
          </Button>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  )
}
