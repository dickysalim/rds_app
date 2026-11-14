// quality_control is locked to Stock Management (plus their own Account
// Settings) -- everything else (nav items and direct URL navigation alike)
// redirects to Stock Management. admin/staging_admin are locked to Nota,
// Stock Management, Customer, Product, Raw Material, Raw Mat. Management,
// plus Account Settings. Every other role is unrestricted.
export function isPathAllowed(role: string, path: string): boolean {
  if (role === 'quality_control') {
    return path.startsWith('/stock-management') || path.startsWith('/account-settings')
  }
  if (role === 'admin' || role === 'staging_admin') {
    return (
      path.startsWith('/nota') ||
      path.startsWith('/stock-management') ||
      path.startsWith('/customer') ||
      path.startsWith('/product') ||
      path.startsWith('/raw-material') ||
      path.startsWith('/raw-mat-management') ||
      path.startsWith('/account-settings')
    )
  }
  return true
}

// admin/staging_admin never see cost/profit/margin figures.
export function hideFinancials(role: string): boolean {
  return role === 'admin' || role === 'staging_admin'
}
