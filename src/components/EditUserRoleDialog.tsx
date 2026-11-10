import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUpdateUserRoleMutation } from '@/lib/queries'
import { ROLE_OPTIONS, type AssignableRole, type TeamUser } from '@/lib/users'

export function EditUserRoleDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: TeamUser | null
}) {
  const [role, setRole] = useState<AssignableRole>('admin')
  const [error, setError] = useState<string | null>(null)
  const updateMutation = useUpdateUserRoleMutation()

  useEffect(() => {
    if (open && user) {
      setRole(user.role as AssignableRole)
      setError(null)
    }
  }, [open, user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!user) return
    try {
      await updateMutation.mutateAsync({ userId: user.user_id, role })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Role</DialogTitle>
          <DialogDescription>{user ? `Change the role for ${user.username}.` : ''}</DialogDescription>
        </DialogHeader>
        <form id="edit-user-role-form" className="space-y-4" onSubmit={handleSubmit}>
          <Select value={role} onValueChange={(v) => setRole(v as AssignableRole)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </form>
        <DialogFooter>
          <Button type="submit" form="edit-user-role-form" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
