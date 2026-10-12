import { apiFetch } from '@/lib/api'

export interface Customer {
  customer_id: number
  company_name: string
  address: string | null
  contact_name: string | null
  phone_number: string | null
}

export async function listCustomers(): Promise<Customer[]> {
  const res = await apiFetch('/customers')
  if (!res.ok) throw new Error('Failed to load customers')
  const data = (await res.json()) as { customers: Customer[] }
  return data.customers
}
