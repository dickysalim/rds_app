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

export interface CustomerInput {
  company_name: string
  address: string | null
  contact_name: string
  phone_number: string
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const res = await apiFetch('/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { customer?: Customer; error?: string }
  if (!res.ok || !data.customer) throw new Error(data.error ?? 'Failed to create customer')
  return data.customer
}
