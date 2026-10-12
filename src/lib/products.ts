import { apiFetch } from '@/lib/api'

export interface Product {
  sku_id: number
  sku_name: string
  unit: string
  suggested_price: number | null
  is_active: number
}

export async function listProducts(): Promise<Product[]> {
  const res = await apiFetch('/products')
  if (!res.ok) throw new Error('Failed to load products')
  const data = (await res.json()) as { products: Product[] }
  return data.products
}

export async function createProduct(input: {
  sku_name: string
  unit: string
  suggested_price: number | null
}): Promise<Product> {
  const res = await apiFetch('/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { product?: Product; error?: string }
  if (!res.ok || !data.product) throw new Error(data.error ?? 'Failed to create product')
  return data.product
}
