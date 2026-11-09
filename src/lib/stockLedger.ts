import { apiFetch } from '@/lib/api'

export interface StockLedgerEntry {
  kind: 'ledger' | 'sale'
  id: number
  sku_id: number
  item_name: string | null
  date: string
  movement_type: 'stock_input' | 'stock_loss' | 'adjust_up' | 'adjust_down' | 'sale'
  qty: number
  note: string | null
  created_by: string | null
  created_at: string
  invoice_number: string | null
}

export async function listStockLedger(): Promise<StockLedgerEntry[]> {
  const res = await apiFetch('/stock-ledger')
  if (!res.ok) throw new Error('Failed to load stock ledger')
  const data = (await res.json()) as { entries: StockLedgerEntry[] }
  return data.entries
}

export interface StockMovementInput {
  sku_id: number
  date: string
  movement_type: 'stock_input' | 'stock_loss' | 'adjust_up' | 'adjust_down'
  qty: number
  note?: string | null
}

export async function createStockMovement(input: StockMovementInput): Promise<StockLedgerEntry> {
  const res = await apiFetch('/stock-ledger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { entry?: StockLedgerEntry; error?: string }
  if (!res.ok || !data.entry) throw new Error(data.error ?? 'Failed to add stock movement')
  return data.entry
}
