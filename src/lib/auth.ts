import { apiFetch, clearToken, setToken } from '@/lib/api'

export interface AuthUser {
  id: number
  username: string
  name: string
  role: string
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

export function logout(): void {
  clearToken()
}
