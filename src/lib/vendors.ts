import { apiFetch } from '@/lib/api'

export interface Vendor {
  vendor_id: number
  vendor_name: string
  address: string | null
  contact_person: string | null
  phone_number: string | null
  updated_by: string | null
  updated_at: string
}

export async function listVendors(): Promise<Vendor[]> {
  const res = await apiFetch('/vendors')
  if (!res.ok) throw new Error('Failed to load vendors')
  const data = (await res.json()) as { vendors: Vendor[] }
  return data.vendors
}
