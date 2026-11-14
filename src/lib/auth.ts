import { apiFetch, clearToken, setToken, setUsingStagingDb } from '@/lib/api'

export interface AuthUser {
  id: string
  username: string
  name: string
  role: string
  must_change_password: boolean
}

interface LoginResponse {
  token: string
  user: AuthUser
}

interface ErrorResponse {
  error: string
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  const data = (await res.json()) as LoginResponse | ErrorResponse
  if (!res.ok) throw new Error('error' in data ? data.error : 'Login failed')

  setToken((data as LoginResponse).token)
  return (data as LoginResponse).user
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await apiFetch('/auth/me')
  if (!res.ok) return null
  const data = (await res.json()) as { user: AuthUser }
  return data.user
}

export async function updateAccountName(name: string): Promise<AuthUser> {
  const res = await apiFetch('/auth/account', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const data = (await res.json()) as LoginResponse | ErrorResponse
  if (!res.ok) throw new Error('error' in data ? data.error : 'Failed to update name')
  setToken((data as LoginResponse).token)
  return (data as LoginResponse).user
}

export async function updatePassword(currentPassword: string, newPassword: string): Promise<AuthUser> {
  const res = await apiFetch('/auth/password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  })
  const data = (await res.json()) as LoginResponse | ErrorResponse
  if (!res.ok) throw new Error('error' in data ? data.error : 'Failed to update password')
  setToken((data as LoginResponse).token)
  return (data as LoginResponse).user
}

export function logout(): void {
  clearToken()
  setUsingStagingDb(false)
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  owner: 'Owner',
  admin: 'Admin',
  staff: 'Staff',
  quality_control: 'Quality Control',
  staging_admin: 'Admin',
  // Test-only roles, forced onto the staging DB server-side -- labeled like
  // their real counterpart since they look/behave the same otherwise.
  test_owner: 'Owner',
  test_admin: 'Admin',
}

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role
}
