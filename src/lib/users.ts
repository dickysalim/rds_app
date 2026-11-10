import { apiFetch } from '@/lib/api'

export type AssignableRole = 'staff' | 'quality_control'

export interface TeamUser {
  user_id: string
  username: string
  name: string
  role: string
}

export async function listUsers(): Promise<TeamUser[]> {
  const res = await apiFetch('/users')
  if (!res.ok) throw new Error('Failed to load users')
  const data = (await res.json()) as { users: TeamUser[] }
  return data.users
}

export interface CreateUserInput {
  username: string
  name: string
  role: AssignableRole
}

export interface CreateUserResult {
  user: TeamUser
  temporary_password: string
}

export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const res = await apiFetch('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as CreateUserResult & { error?: string }
  if (!res.ok || !data.user) throw new Error(data.error ?? 'Failed to create user')
  return data
}

export async function updateUserRole(userId: string, role: AssignableRole): Promise<TeamUser> {
  const res = await apiFetch(`/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  const data = (await res.json()) as { user?: TeamUser; error?: string }
  if (!res.ok || !data.user) throw new Error(data.error ?? 'Failed to update role')
  return data.user
}

export async function resetUserPassword(userId: string): Promise<string> {
  const res = await apiFetch(`/users/${userId}/reset-password`, { method: 'POST' })
  const data = (await res.json()) as { temporary_password?: string; error?: string }
  if (!res.ok || !data.temporary_password) throw new Error(data.error ?? 'Failed to reset password')
  return data.temporary_password
}

export async function deactivateUser(userId: string): Promise<void> {
  const res = await apiFetch(`/users/${userId}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? 'Failed to deactivate user')
  }
}
