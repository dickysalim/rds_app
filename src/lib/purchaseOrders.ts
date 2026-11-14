import { apiFetch } from '@/lib/api'

export interface PurchaseOrderItemInput {
  raw_mat_id: number | null
  raw_mat_sku_name: string
  unit: string
  qty: number
  price: number | null
  note?: string | null
}

export interface PurchaseOrderInput {
  po_date: string
  po_number?: string | null
  items: PurchaseOrderItemInput[]
}

export interface PurchaseOrder {
  po_date: string
  po_number: string | null
}

export async function createPurchaseOrder(input: PurchaseOrderInput): Promise<PurchaseOrder> {
  const res = await apiFetch('/purchase-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { purchase_order?: PurchaseOrder; error?: string }
  if (!res.ok || !data.purchase_order) throw new Error(data.error ?? 'Failed to create purchase order')
  return data.purchase_order
}
