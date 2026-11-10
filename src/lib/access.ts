// quality_control is locked to Stock Management (plus their own Account
// Settings) -- everything else (nav items and direct URL navigation alike)
// redirects to Stock Management. Every other role is unrestricted.
export function isPathAllowed(role: string, path: string): boolean {
  if (role === 'quality_control') {
    return path.startsWith('/stock-management') || path.startsWith('/account-settings')
  }
  return true
}
