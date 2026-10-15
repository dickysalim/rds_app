import { Home, Receipt, Users, Package, Settings } from 'lucide-react'
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

const items = [
  { title: 'Home', url: '/', icon: Home },
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

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-1.5 text-sm font-semibold tracking-tight">
          RDS Factory Management
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
          <span className="truncate text-xs text-muted-foreground">
            {user.name} <Badge variant="secondary">{user.role}</Badge>
          </span>
          <Button variant="outline" size="sm" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
