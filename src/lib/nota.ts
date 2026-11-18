import { API_URL, apiFetch, getToken } from '@/lib/api'

export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'QRIS', 'Giro', 'Other'] as const

export const UNITS = ['pcs', 'box', 'lusin', 'kodi', 'rim', 'pack', 'kg', 'gram', 'liter', 'meter', 'roll', 'set', 'lembar', 'batang', 'kaleng', 'drum'] as const

export interface NotaListItem {
  nota_id: number
  nota_number: string
  nota_date: string
  customer_id: number
  customer_company_name_snapshot: string
  contact_name_snapshot: string | null
  total_price: number
  total_cost: number
  notes: string | null
  paid_amount: number
  status: string
  pajak_name: string | null
  pajak_percentage: number | null
  created_by: string | null
}

export function pajakCostOf(n: Pick<NotaListItem, 'total_price' | 'pajak_percentage'>): number {
  return n.pajak_percentage != null ? (n.total_price * n.pajak_percentage) / 100 : 0
}

export function totalBillOf(n: Pick<NotaListItem, 'total_price' | 'pajak_percentage'>): number {
  return n.total_price + pajakCostOf(n)
}

export interface Totals {
  notaCount: number
  totalBill: number
  totalUnpaid: number
  totalPaid: number
}

export function outstandingOf(n: NotaListItem): number {
  return n.status === 'void' ? 0 : n.total_price - n.paid_amount
}

export function sumTotals(nota: NotaListItem[]): Totals {
  return {
    notaCount: nota.length,
    totalBill: nota.reduce((sum, n) => sum + n.total_price, 0),
    totalUnpaid: nota.reduce((sum, n) => sum + outstandingOf(n), 0),
    totalPaid: nota.reduce((sum, n) => sum + n.paid_amount, 0),
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'paid':
      return 'Paid'
    case 'partial':
      return 'Partially Paid'
    case 'unpaid':
      return 'Unpaid'
    default:
      return status.charAt(0).toUpperCase() + status.slice(1)
  }
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
  startDate?: string
  endDate?: string
}): Promise<NotaPage> {
  const query = new URLSearchParams()
  if (params?.limit != null) query.set('limit', String(params.limit))
  if (params?.offset != null) query.set('offset', String(params.offset))
  if (params?.q) query.set('q', params.q)
  if (params?.status) query.set('status', params.status)
  if (params?.startDate) query.set('start_date', params.startDate)
  if (params?.endDate) query.set('end_date', params.endDate)
  const qs = query.toString()
  const res = await apiFetch(`/nota${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error('Failed to load nota')
  const data = (await res.json()) as { nota: NotaListItem[]; total: number }
  return { nota: data.nota, total: data.total }
}

export interface NotaDateRange {
  minYear: number | null
  minMonth: number | null
  maxYear: number | null
  maxMonth: number | null
}

export async function getNotaDateRange(): Promise<NotaDateRange> {
  const res = await apiFetch('/nota/date-range')
  if (!res.ok) throw new Error('Failed to load nota date range')
  return (await res.json()) as NotaDateRange
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
  contact_name: string | null
  phone_number: string | null
  notes?: string | null
  business_id?: number | null
  pajak_name?: string | null
  pajak_percentage?: number | null
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
  cost_price_snapshot: number | null
}

export interface NotaDetail {
  nota_id: number
  nota_number: string
  nota_date: string
  customer_company_name_snapshot: string
  customer_address_snapshot: string | null
  contact_name_snapshot: string | null
  contact_phone_number_snapshot: string | null
  total_price: number
  paid_amount: number
  status: string
  notes: string | null
  business_id: number | null
  pajak_name: string | null
  pajak_percentage: number | null
  items: NotaDetailItem[]
}

export async function getNota(notaId: number): Promise<NotaDetail> {
  const res = await apiFetch(`/nota/${notaId}`)
  const data = (await res.json()) as { nota?: NotaDetail; error?: string }
  if (!res.ok || !data.nota) throw new Error(data.error ?? 'Failed to load nota')
  return data.nota
}

export interface NotaUpdateInput {
  notes?: string | null
  business_id?: number | null
  pajak_name?: string | null
  pajak_percentage?: number | null
}

export async function updateNota(notaId: number, input: NotaUpdateInput): Promise<void> {
  const res = await apiFetch(`/nota/${notaId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? 'Failed to update nota')
  }
}

export async function voidNota(notaId: number): Promise<void> {
  const res = await apiFetch(`/nota/${notaId}/void`, { method: 'PUT' })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? 'Failed to delete nota')
  }
}

// A payment belongs to the bill (customer + month), not a single nota.
export interface Payment {
  payment_id: number
  payment_number: string | null
  payment_date: string
  amount: number
  method: string | null
  reference: string | null
  evidence_key: string | null
  customer_id: number
  bill_year: number
  bill_month: number
  bill_settled: number
}

export function billPeriodOf(n: { nota_date: string }): { year: number; month: number } {
  return { year: Number(n.nota_date.slice(0, 4)), month: Number(n.nota_date.slice(5, 7)) }
}

export function billNumber(customerId: number, year: number, month: number): string {
  const yy = String(year).slice(-2)
  const mm = String(month).padStart(2, '0')
  return `BIL/${yy}${mm}/${customerId}`
}

export async function listBillPayments(
  customerId: number,
  year: number,
  month: number,
): Promise<Payment[]> {
  const res = await apiFetch(`/customers/${customerId}/bill-payments?year=${year}&month=${month}`)
  if (!res.ok) throw new Error('Failed to load payments')
  const data = (await res.json()) as { payments: Payment[] }
  return data.payments
}

export interface PaymentInput {
  year: number
  month: number
  payment_date: string
  amount: number
  method: string
  reference?: string | null
}

export async function createBillPayment(customerId: number, input: PaymentInput): Promise<Payment> {
  const res = await apiFetch(`/customers/${customerId}/bill-payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { payment?: Payment; error?: string }
  if (!res.ok || !data.payment) throw new Error(data.error ?? 'Failed to record payment')
  return data.payment
}

export async function voidPayment(paymentId: number): Promise<void> {
  const res = await apiFetch(`/payments/${paymentId}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? 'Failed to delete payment')
  }
}

export function getPaymentEvidenceUrl(paymentId: number): string {
  // Opened as a plain <a href>, not apiFetch, so it can't carry an
  // Authorization header -- the backend also accepts the token here as a
  // query param.
  const token = getToken() ?? ''
  return `${API_URL}/payments/${paymentId}/evidence?t=${Date.now()}&token=${encodeURIComponent(token)}`
}

export async function uploadPaymentEvidence(paymentId: number, blob: Blob): Promise<void> {
  const res = await apiFetch(`/payments/${paymentId}/evidence`, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type },
    body: blob,
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? 'Failed to upload evidence')
  }
}
