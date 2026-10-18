import { Receipt, Users, Package, Settings } from 'lucide-react'
import { getBusinessLogoUrl } from '@/lib/business'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AuthUser } from '@/lib/auth'
import { useNavGuard } from '@/lib/nav-guard'
import { useBusinessQuery } from '@/lib/queries'

const items = [
  { title: 'Nota', url: '/nota', icon: Receipt },
  { title: 'Customer', url: '/customer', icon: Users },
  { title: 'Product', url: '/product', icon: Package },
  { title: 'Business Settings', url: '/business-settings', icon: Settings },
]

export function AppSidebar({
  user,
  onLogout,
}: {
  user: AuthUser
  onLogout: () => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { guardRef } = useNavGuard()
  const { data: business } = useBusinessQuery()

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex flex-col items-center gap-2 px-2 py-3">
          {business?.business_logo_key ? (
            <img
              src={getBusinessLogoUrl()}
              alt="Business logo"
              className="size-20 rounded-full border-2 border-sidebar-border bg-background object-cover shadow-sm"
            />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-full border-2 border-sidebar-border bg-background text-lg font-semibold text-muted-foreground shadow-sm">
              {(business?.business_name ?? 'RDS').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="text-center text-sm font-semibold tracking-tight">
            {business?.business_name ?? 'RDS Factory Management'}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive =
                  item.url === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.url)
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink
                        to={item.url}
                        onClick={(e) => {
                          if (guardRef.current) {
                            e.preventDefault()
                            guardRef.current(() => navigate(item.url))
                          }
                        }}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="truncate text-xs text-sidebar-foreground/70">
            {user.name} <Badge variant="secondary">{user.role}</Badge>
          </span>
          <Button
            variant="outline"
            size="sm"
            className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:bg-transparent"
            onClick={onLogout}
          >
            Sign out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
