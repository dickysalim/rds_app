import { API_URL, apiFetch } from '@/lib/api'

export interface Business {
  business_id: number
  business_name: string
  business_address: string | null
  business_contact_person: string | null
  business_contact_number: string | null
  business_email: string | null
  business_logo_key: string | null
  payment_bank_name: string | null
  payment_account_name: string | null
  payment_account_number: string | null
}

export function getBusinessLogoUrl(): string {
  return `${API_URL}/business/logo?t=${Date.now()}`
}

export async function uploadBusinessLogo(blob: Blob): Promise<void> {
  const res = await apiFetch('/business/logo', {
    method: 'PUT',
    headers: { 'Content-Type': blob.type },
    body: blob,
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? 'Failed to upload logo')
  }
}

export async function getBusiness(): Promise<Business | null> {
  const res = await apiFetch('/business')
  if (!res.ok) throw new Error('Failed to load business settings')
  const data = (await res.json()) as { business: Business | null }
  return data.business
}

export interface BusinessInput {
  business_name: string
  business_address: string | null
  business_contact_person: string | null
  business_contact_number: string | null
  business_email: string | null
  payment_bank_name: string | null
  payment_account_name: string | null
  payment_account_number: string | null
}

export async function updateBusiness(input: BusinessInput): Promise<Business> {
  const res = await apiFetch('/business', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { business?: Business; error?: string }
  if (!res.ok || !data.business) throw new Error(data.error ?? 'Failed to save business settings')
  return data.business
}

// An alias is another row in the same `business` table (an alternate
// identity for the company), same shape as the primary business row.
export type BusinessAlias = Business

export async function listBusinessAliases(): Promise<BusinessAlias[]> {
  const res = await apiFetch('/business/aliases')
  if (!res.ok) throw new Error('Failed to load aliases')
  const data = (await res.json()) as { aliases: BusinessAlias[] }
  return data.aliases
}

export async function createBusinessAlias(input: BusinessInput): Promise<BusinessAlias> {
  const res = await apiFetch('/business/aliases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { business?: BusinessAlias; error?: string }
  if (!res.ok || !data.business) throw new Error(data.error ?? 'Failed to create alias')
  return data.business
}

export async function updateBusinessAlias(businessId: number, input: BusinessInput): Promise<BusinessAlias> {
  const res = await apiFetch(`/business/aliases/${businessId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { business?: BusinessAlias; error?: string }
  if (!res.ok || !data.business) throw new Error(data.error ?? 'Failed to save alias')
  return data.business
}

// Soft delete only -- the alias is flagged inactive and kept (past nota and
// payment PDFs issued under it keep working), so this never shows up in
// listBusinessAliases again.
export async function deleteBusinessAlias(businessId: number): Promise<void> {
  const res = await apiFetch(`/business/aliases/${businessId}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? 'Failed to delete alias')
  }
}

export function getBusinessAliasLogoUrl(businessId: number): string {
  return `${API_URL}/business/aliases/${businessId}/logo?t=${Date.now()}`
}

export async function uploadBusinessAliasLogo(businessId: number, blob: Blob): Promise<void> {
  const res = await apiFetch(`/business/aliases/${businessId}/logo`, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type },
    body: blob,
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? 'Failed to upload logo')
  }
}
