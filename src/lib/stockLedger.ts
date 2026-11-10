import { apiFetch } from '@/lib/api'

export type StockMovementType =
  | 'production_in'
  | 'shipment_return'
  | 'adjust_up'
  | 'stock_loss'
  | 'stock_out'
  | 'stock_defect'
  | 'adjust_down'

export interface StockLedgerEntry {
  kind: 'ledger' | 'sale'
  id: number
  sku_id: number
  item_name: string | null
  date: string
  movement_type: StockMovementType | 'sale'
  qty: number
  note: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string | null
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
  movement_type: StockMovementType
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

export interface StockMovementUpdateInput {
  date: string
  movement_type: StockMovementType
  qty: number
  note?: string | null
}

export async function updateStockMovement(id: number, input: StockMovementUpdateInput): Promise<StockLedgerEntry> {
  const res = await apiFetch(`/stock-ledger/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { entry?: StockLedgerEntry; error?: string }
  if (!res.ok || !data.entry) throw new Error(data.error ?? 'Failed to update stock movement')
  return data.entry
}

// Soft delete -- the row is kept, just flagged inactive (and stamped with
// who did it), so this never shows up in listStockLedger again.
export async function deleteStockMovement(id: number): Promise<void> {
  const res = await apiFetch(`/stock-ledger/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? 'Failed to delete stock movement')
  }
}
