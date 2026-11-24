import { Receipt, Users, Package, Settings, Boxes, UserCog, UsersRound, Tag, Wheat, ClipboardList } from 'lucide-react'
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
import { isUsingStagingDb } from '@/lib/api'
import { isPathAllowed } from '@/lib/access'
import type { AuthUser } from '@/lib/auth'
import { useNavGuard } from '@/lib/nav-guard'
import { useBusinessQuery } from '@/lib/queries'

const salesItems = [
  { title: 'Nota', url: '/nota', icon: Receipt },
  { title: 'Customer', url: '/customer', icon: Users },
]

const operationItems = [
  { title: 'Stock Management', url: '/stock-management', icon: Boxes },
  { title: 'Product', url: '/product', icon: Package },
  { title: 'Raw Mat. Management', url: '/raw-mat-management', icon: ClipboardList },
  { title: 'Raw Material', url: '/raw-material', icon: Wheat },
]

const settingsItems = [
  { title: 'Business Settings', url: '/business-settings', icon: Settings },
  { title: 'Alias', url: '/alias-settings', icon: Tag },
  { title: 'Account Settings', url: '/account-settings', icon: UserCog },
  { title: 'Team Settings', url: '/team-settings', icon: UsersRound },
]

function renderItem(
  item: { title: string; url: string; icon: typeof Receipt },
  location: ReturnType<typeof useLocation>,
  guardRef: ReturnType<typeof useNavGuard>['guardRef'],
  navigate: ReturnType<typeof useNavigate>,
) {
  const isActive =
    item.url === '/' ? location.pathname === '/' : location.pathname.startsWith(item.url)
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
}

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

  const visibleSalesItems = salesItems.filter((item) => isPathAllowed(user.role, item.url))
  const visibleOperationItems = operationItems.filter((item) => isPathAllowed(user.role, item.url))
  const visibleSettingsItems = settingsItems.filter((item) => isPathAllowed(user.role, item.url))

  return (
    <Sidebar>
      <SidebarHeader>
        {(import.meta.env.VITE_STAGING_LOCKED === 'true' ||
          ((user.role === 'super_admin' || user.role === 'staging_admin') && isUsingStagingDb()) ||
          user.role === 'test_owner' ||
          user.role === 'test_admin') && (
          <div className="mx-2 mt-2 rounded-md bg-amber-500 px-2 py-1 text-center text-xs font-semibold text-white">
            STAGING DATABASE
          </div>
        )}
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
        {visibleSalesItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Sales</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleSalesItems.map((item) => renderItem(item, location, guardRef, navigate))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {visibleOperationItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Operation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleOperationItems.map((item) => renderItem(item, location, guardRef, navigate))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {visibleSettingsItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Utility</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleSettingsItems.map((item) => renderItem(item, location, guardRef, navigate))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
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
