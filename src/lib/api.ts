export const API_URL = import.meta.env.VITE_API_URL as string

const TOKEN_KEY = 'rds_token'
const DB_TARGET_KEY = 'rds_db_target'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

// Only takes effect server-side for a super_admin session; ignored for
// everyone else. Persisted across reloads so the choice sticks per device.
export function isUsingStagingDb(): boolean {
  return localStorage.getItem(DB_TARGET_KEY) === 'staging'
}

export function setUsingStagingDb(useStaging: boolean): void {
  if (useStaging) localStorage.setItem(DB_TARGET_KEY, 'staging')
  else localStorage.removeItem(DB_TARGET_KEY)
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (isUsingStagingDb()) headers.set('X-Db-Target', 'staging')
  return fetch(`${API_URL}${path}`, { ...init, headers })
}
