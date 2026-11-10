import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AddUserDialog } from '@/components/AddUserDialog'
import { EditUserRoleDialog } from '@/components/EditUserRoleDialog'
import { ResetPasswordDialog } from '@/components/ResetPasswordDialog'
import { roleLabel } from '@/lib/auth'
import { useDeactivateUserMutation, useUsersQuery } from '@/lib/queries'
import type { TeamUser } from '@/lib/users'

export function TeamSettingsPage() {
  const { data: users, isLoading } = useUsersQuery()
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null)
  const [resettingUser, setResettingUser] = useState<TeamUser | null>(null)
  const [deactivatingUser, setDeactivatingUser] = useState<TeamUser | null>(null)
  const deactivateMutation = useDeactivateUserMutation()

  async function handleDeactivate() {
    if (!deactivatingUser) return
    await deactivateMutation.mutateAsync(deactivatingUser.user_id)
    setDeactivatingUser(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Team Settings</h1>
          <p className="text-muted-foreground text-sm">Manage staff accounts.</p>
        </div>
        <Button onClick={() => setAddUserOpen(true)}>+ Add User</Button>
      </div>

      <div className="overflow-x-auto rounded-md border bg-panel shadow-sm border-[oklch(0.84_0_0)] [&_tr]:border-[oklch(0.86_0_0)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User Name</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-center">
                  Loading…
                </TableCell>
              </TableRow>
            ) : users?.length ? (
              users.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{roleLabel(user.role)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
                        >
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingUser(user)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setResettingUser(user)}>Reset Password</DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => setDeactivatingUser(user)}>
                          Deactivate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-center">
                  No users yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AddUserDialog open={addUserOpen} onOpenChange={setAddUserOpen} />
      <EditUserRoleDialog
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        user={editingUser}
      />
      <ResetPasswordDialog
        open={!!resettingUser}
        onOpenChange={(open) => !open && setResettingUser(null)}
        user={resettingUser}
      />
      <AlertDialog open={!!deactivatingUser} onOpenChange={(open) => !open && setDeactivatingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate user?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivatingUser?.username} will no longer be able to log in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} disabled={deactivateMutation.isPending}>
              {deactivateMutation.isPending ? 'Deactivating…' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
