import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateUserMutation } from '@/lib/queries'
import type { AssignableRole } from '@/lib/users'

const ROLE_OPTIONS: { value: AssignableRole; label: string }[] = [
  { value: 'staff', label: 'Staff' },
  { value: 'quality_control', label: 'Quality Control' },
]

export function AddUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<AssignableRole>('staff')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ username: string; password: string } | null>(null)
  const createMutation = useCreateUserMutation()

  function reset() {
    setUsername('')
    setName('')
    setRole('staff')
    setError(null)
    setResult(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!username.trim() || !name.trim()) {
      setError('Username and name are required')
      return
    }
    try {
      const created = await createMutation.mutateAsync({ username: username.trim(), name: name.trim(), role })
      setResult({ username: created.user.username, password: created.temporary_password })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>User Created</DialogTitle>
              <DialogDescription>
                Share this password with {result.username} now — it won't be shown again. They'll be asked to
                change it on first login.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <Input readOnly value={result.password} className="font-mono text-lg tracking-widest" />
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  onOpenChange(false)
                  reset()
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add User</DialogTitle>
              <DialogDescription>Creates an account with a random temporary password.</DialogDescription>
            </DialogHeader>
            <form id="add-user-form" className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="new_user_username">User Name</Label>
                <Input id="new_user_username" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_user_name">Name</Label>
                <Input id="new_user_name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_user_role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AssignableRole)}>
                  <SelectTrigger id="new_user_role" className="w-full">
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
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
            </form>
            <DialogFooter>
              <Button type="submit" form="add-user-form" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create User'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
