import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updatePassword, type AuthUser } from '@/lib/auth'

export function ForcePasswordChangePage({
  knownCurrentPassword,
  onDone,
}: {
  knownCurrentPassword: string | null
  onDone: (user: AuthUser) => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match')
      return
    }
    setSaving(true)
    try {
      const updated = await updatePassword(knownCurrentPassword ?? currentPassword, newPassword)
      onDone(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <form className="w-full max-w-sm space-y-4" onSubmit={handleSubmit}>
        <div>
          <h1 className="text-xl font-semibold">Change Your Password</h1>
          <p className="text-muted-foreground text-sm">
            This is a new account. Set your own password before continuing.
          </p>
        </div>
        {knownCurrentPassword == null && (
          <div className="space-y-2">
            <Label htmlFor="force_current_password">Temporary Password</Label>
            <Input
              id="force_current_password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="force_new_password">New Password</Label>
          <Input
            id="force_new_password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="force_confirm_password">Confirm New Password</Label>
          <Input
            id="force_confirm_password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? 'Saving…' : 'Change Password'}
        </Button>
      </form>
    </div>
  )
}
