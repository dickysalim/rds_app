import { apiFetch } from '@/lib/api'

export interface NotaListItem {
  nota_id: number
  nota_number: string
  nota_date: string
  customer_company_name_snapshot: string
  contact_name_snapshot: string
  total_price: number
  paid_amount: number
  status: string
}

export async function listNota(): Promise<NotaListItem[]> {
  const res = await apiFetch('/nota')
  if (!res.ok) throw new Error('Failed to load nota')
  const data = (await res.json()) as { nota: NotaListItem[] }
  return data.nota
}

export interface NotaItemInput {
  sku_id: number | null
  sku_name: string
  unit: string
  price: number
  qty: number
  discount_amount: number
  discount_percent: number
}

export interface NotaInput {
  nota_date: string
  company_name: string
  company_address: string | null
  contact_name: string
  phone_number: string
  items: NotaItemInput[]
}

export async function createNota(input: NotaInput): Promise<NotaListItem> {
  const res = await apiFetch('/nota', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { nota?: NotaListItem; error?: string }
  if (!res.ok || !data.nota) throw new Error(data.error ?? 'Failed to create nota')
  return data.nota
}

export interface NotaDetailItem {
  nota_item_id: number
  item_name_snapshot: string
  unit_snapshot: string
  qty: number
  price: number
  discount_amount: number
  discount_percent: number
  total_price: number
}

export interface NotaDetail {
  nota_id: number
  nota_number: string
  nota_date: string
  customer_company_name_snapshot: string
  customer_address_snapshot: string | null
  contact_name_snapshot: string
  contact_phone_number_snapshot: string
  total_price: number
  paid_amount: number
  status: string
  items: NotaDetailItem[]
}

export async function getNota(notaId: number): Promise<NotaDetail> {
  const res = await apiFetch(`/nota/${notaId}`)
  const data = (await res.json()) as { nota?: NotaDetail; error?: string }
  if (!res.ok || !data.nota) throw new Error(data.error ?? 'Failed to load nota')
  return data.nota
}
