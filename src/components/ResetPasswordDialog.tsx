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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useResetUserPasswordMutation } from '@/lib/queries'
import type { TeamUser } from '@/lib/users'

export function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: TeamUser | null
}) {
  const [password, setPassword] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const resetMutation = useResetUserPasswordMutation()

  useEffect(() => {
    if (open) {
      setPassword(null)
      setError(null)
    }
  }, [open])

  async function handleReset() {
    if (!user) return
    setError(null)
    try {
      const newPassword = await resetMutation.mutateAsync(user.user_id)
      setPassword(newPassword)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {password ? (
          <>
            <DialogHeader>
              <DialogTitle>Password Reset</DialogTitle>
              <DialogDescription>
                Share this password with {user?.username} now — it won't be shown again. They'll be asked to
                change it on next login.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <Input readOnly value={password} className="font-mono text-lg tracking-widest" />
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                {user ? `Generate a new temporary password for ${user.username}.` : ''} They'll be required to
                change it on their next login.
              </DialogDescription>
            </DialogHeader>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <DialogFooter>
              <Button type="button" onClick={handleReset} disabled={resetMutation.isPending}>
                {resetMutation.isPending ? 'Resetting…' : 'Reset Password'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
