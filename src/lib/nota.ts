import { API_URL, apiFetch } from '@/lib/api'

export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'QRIS', 'Check', 'Other'] as const

export const UNITS = ['pcs', 'box', 'pack', 'roll', 'kg', 'gram', 'liter', 'meter'] as const

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

export function statusPillClass(status: string): string {
  switch (status) {
    case 'paid':
      return 'rounded bg-green-100 px-2 py-0.5 text-green-700'
    case 'partial':
      return 'rounded bg-amber-100 px-2 py-0.5 text-amber-700'
    default:
      return 'rounded bg-red-100 px-2 py-0.5 text-red-700'
  }
}

export interface NotaPage {
  nota: NotaListItem[]
  total: number
}

export async function listNota(params?: {
  limit?: number
  offset?: number
  q?: string
  status?: string
  year?: string
  month?: string
}): Promise<NotaPage> {
  const query = new URLSearchParams()
  if (params?.limit != null) query.set('limit', String(params.limit))
  if (params?.offset != null) query.set('offset', String(params.offset))
  if (params?.q) query.set('q', params.q)
  if (params?.status) query.set('status', params.status)
  if (params?.year) query.set('year', params.year)
  if (params?.month) query.set('month', params.month)
  const qs = query.toString()
  const res = await apiFetch(`/nota${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error('Failed to load nota')
  const data = (await res.json()) as { nota: NotaListItem[]; total: number }
  return { nota: data.nota, total: data.total }
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

export async function voidNota(notaId: number): Promise<void> {
  const res = await apiFetch(`/nota/${notaId}/void`, { method: 'PUT' })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? 'Failed to delete nota')
  }
}

export interface Payment {
  payment_id: number
  payment_number: string | null
  payment_date: string
  amount: number
  method: string | null
  reference: string | null
  evidence_key: string | null
}

export async function listPayments(notaId: number): Promise<Payment[]> {
  const res = await apiFetch(`/nota/${notaId}/payments`)
  if (!res.ok) throw new Error('Failed to load payments')
  const data = (await res.json()) as { payments: Payment[] }
  return data.payments
}

export interface PaymentInput {
  payment_date: string
  amount: number
  method: string
  reference?: string | null
}

export async function createPayment(notaId: number, input: PaymentInput): Promise<Payment> {
  const res = await apiFetch(`/nota/${notaId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { payment?: Payment; error?: string }
  if (!res.ok || !data.payment) throw new Error(data.error ?? 'Failed to record payment')
  return data.payment
}

export function getPaymentEvidenceUrl(notaId: number, paymentId: number): string {
  return `${API_URL}/nota/${notaId}/payments/${paymentId}/evidence?t=${Date.now()}`
}

export async function uploadPaymentEvidence(
  notaId: number,
  paymentId: number,
  blob: Blob,
): Promise<void> {
  const res = await apiFetch(`/nota/${notaId}/payments/${paymentId}/evidence`, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type },
    body: blob,
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? 'Failed to upload evidence')
  }
}
