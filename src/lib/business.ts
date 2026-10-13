import { API_URL, apiFetch } from '@/lib/api'

export interface Business {
  business_id: number
  business_name: string
  business_address: string | null
  business_contact_number: string | null
  business_email: string | null
  business_logo_key: string | null
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
  business_contact_number: string | null
  business_email: string | null
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
