import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AppOutletContext } from '@/components/AppLayout'
import { roleLabel, updateAccountName, updatePassword } from '@/lib/auth'

export function AccountSettingsPage() {
  const { user, onUserUpdate } = useOutletContext<AppOutletContext>()

  const [name, setName] = useState(user.name)
  const [nameError, setNameError] = useState<string | null>(null)
  const [nameSuccess, setNameSuccess] = useState(false)
  const [savingName, setSavingName] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault()
    setNameError(null)
    setNameSuccess(false)
    if (!name.trim()) {
      setNameError('Name is required')
      return
    }
    setSavingName(true)
    try {
      const updated = await updateAccountName(name.trim())
      onUserUpdate(updated)
      setNameSuccess(true)
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Failed to update name')
    } finally {
      setSavingName(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match')
      return
    }
    setSavingPassword(true)
    try {
      const updated = await updatePassword(currentPassword, newPassword)
      onUserUpdate(updated)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(true)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Account Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your profile and credentials.</p>
      </div>

      <div className="space-y-2">
        <Label>Username</Label>
        <p className="text-muted-foreground text-sm">{user.username}</p>
      </div>

      <div className="space-y-2">
        <Label>Role</Label>
        <p className="text-muted-foreground text-sm">{roleLabel(user.role)}</p>
      </div>

      <form className="space-y-4" onSubmit={handleNameSubmit}>
        <div className="space-y-2">
          <Label htmlFor="account_name">Name</Label>
          <Input
            id="account_name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setNameSuccess(false)
            }}
            required
          />
        </div>
        {nameError && <p className="text-destructive text-sm">{nameError}</p>}
        {nameSuccess && <p className="text-sm text-[#3EA768]">Name updated.</p>}
        <Button type="submit" disabled={savingName}>
          {savingName ? 'Saving…' : 'Save Name'}
        </Button>
      </form>

      <form className="space-y-4 border-t pt-6" onSubmit={handlePasswordSubmit}>
        <h2 className="text-lg font-medium">Change Password</h2>
        <div className="space-y-2">
          <Label htmlFor="current_password">Current Password</Label>
          <Input
            id="current_password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new_password">New Password</Label>
          <Input
            id="new_password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm_password">Confirm New Password</Label>
          <Input
            id="confirm_password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        {passwordError && <p className="text-destructive text-sm">{passwordError}</p>}
        {passwordSuccess && <p className="text-sm text-[#3EA768]">Password updated.</p>}
        <Button type="submit" disabled={savingPassword}>
          {savingPassword ? 'Saving…' : 'Change Password'}
        </Button>
      </form>
    </div>
  )
}
