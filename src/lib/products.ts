import { apiFetch } from '@/lib/api'

export interface Product {
  sku_id: number
  sku_name: string
  unit: string
  suggested_price: number | null
  cost_price: number | null
  updated_by: string | null
  updated_at: string
  total_revenue: number
  total_cost: number
}

export async function listProducts(): Promise<Product[]> {
  const res = await apiFetch('/products?limit=50')
  if (!res.ok) throw new Error('Failed to load products')
  const data = (await res.json()) as { products: Product[] }
  return data.products
}

export interface ProductInput {
  sku_name: string
  unit: string
  suggested_price: number | null
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const res = await apiFetch('/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { product?: Product; error?: string }
  if (!res.ok || !data.product) throw new Error(data.error ?? 'Failed to create product')
  return data.product
}

export async function updateProduct(skuId: number, input: ProductInput): Promise<Product> {
  const res = await apiFetch(`/products/${skuId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { product?: Product; error?: string }
  if (!res.ok || !data.product) throw new Error(data.error ?? 'Failed to update product')
  return data.product
}

export async function deleteProduct(skuId: number): Promise<void> {
  const res = await apiFetch(`/products/${skuId}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? 'Failed to delete product')
  }
}

export interface ProductHistoryEntry extends Omit<Product, 'total_revenue'> {
  row_increment: number
  is_active: number
}

export async function getProductHistory(skuId: number): Promise<ProductHistoryEntry[]> {
  const res = await apiFetch(`/products/${skuId}/history`)
  if (!res.ok) throw new Error('Failed to load product history')
  const data = (await res.json()) as { history: ProductHistoryEntry[] }
  return data.history
}
