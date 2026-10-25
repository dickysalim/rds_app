import { apiFetch } from '@/lib/api'

export interface Customer {
  customer_id: number
  company_name: string
  address: string | null
  contact_person: string | null
  phone_number: string | null
  updated_by: string | null
  updated_at: string
  total_revenue: number
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
  contact_person: string
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

export async function updateCustomer(
  customerId: number,
  input: CustomerInput,
): Promise<Customer> {
  const res = await apiFetch(`/customers/${customerId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { customer?: Customer; error?: string }
  if (!res.ok || !data.customer) throw new Error(data.error ?? 'Failed to update customer')
  return data.customer
}

export async function deleteCustomer(customerId: number): Promise<void> {
  const res = await apiFetch(`/customers/${customerId}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? 'Failed to delete customer')
  }
}

export interface CustomerHistoryEntry extends Omit<Customer, 'total_revenue'> {
  row_increment: number
  is_active: number
}

export async function getCustomerHistory(customerId: number): Promise<CustomerHistoryEntry[]> {
  const res = await apiFetch(`/customers/${customerId}/history`)
  if (!res.ok) throw new Error('Failed to load customer history')
  const data = (await res.json()) as { history: CustomerHistoryEntry[] }
  return data.history
}
