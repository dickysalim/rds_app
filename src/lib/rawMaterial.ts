import { apiFetch } from '@/lib/api'

export interface RawMaterial {
  raw_mat_id: number
  raw_mat_sku_name: string
  unit: string
  updated_by: string | null
  updated_at: string
  current_stock: number
}

export async function listRawMaterials(): Promise<RawMaterial[]> {
  const res = await apiFetch('/raw-materials?limit=500')
  if (!res.ok) throw new Error('Failed to load raw materials')
  const data = (await res.json()) as { raw_materials: RawMaterial[] }
  return data.raw_materials
}

export interface RawMaterialInput {
  raw_mat_sku_name: string
  unit: string
}

export interface CreateRawMaterialInput extends RawMaterialInput {
  initial_stock: number | null
}

export async function createRawMaterial(input: CreateRawMaterialInput): Promise<RawMaterial> {
  const res = await apiFetch('/raw-materials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { raw_material?: RawMaterial; error?: string }
  if (!res.ok || !data.raw_material) throw new Error(data.error ?? 'Failed to create raw material')
  return data.raw_material
}

export async function updateRawMaterial(rawMatId: number, input: RawMaterialInput): Promise<RawMaterial> {
  const res = await apiFetch(`/raw-materials/${rawMatId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { raw_material?: RawMaterial; error?: string }
  if (!res.ok || !data.raw_material) throw new Error(data.error ?? 'Failed to update raw material')
  return data.raw_material
}

export async function deleteRawMaterial(rawMatId: number): Promise<void> {
  const res = await apiFetch(`/raw-materials/${rawMatId}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? 'Failed to delete raw material')
  }
}

export interface RawMaterialHistoryEntry extends RawMaterial {
  row_increment: number
  is_active: number
}

export async function getRawMaterialHistory(rawMatId: number): Promise<RawMaterialHistoryEntry[]> {
  const res = await apiFetch(`/raw-materials/${rawMatId}/history`)
  if (!res.ok) throw new Error('Failed to load raw material history')
  const data = (await res.json()) as { history: RawMaterialHistoryEntry[] }
  return data.history
}

export type RawMaterialMovementType = 'purchase_in' | 'out_for_production' | 'retur' | 'stock_loss'

export interface RawMaterialLedgerEntry {
  id: number
  raw_mat_id: number
  item_name: string | null
  date: string
  movement_type: RawMaterialMovementType
  qty: number
  note: string | null
  purchase_order_id: number | null
  purchase_order_freetext: string | null
  price: number | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string | null
}

export async function listRawMaterialLedger(): Promise<RawMaterialLedgerEntry[]> {
  const res = await apiFetch('/raw-material-ledger')
  if (!res.ok) throw new Error('Failed to load raw material ledger')
  const data = (await res.json()) as { entries: RawMaterialLedgerEntry[] }
  return data.entries
}

export interface RawMaterialMovementInput {
  raw_mat_id: number
  date: string
  movement_type: RawMaterialMovementType
  qty: number
  note?: string | null
  price?: number | null
  purchase_order_id?: number | null
  purchase_order_freetext?: string | null
}

export async function createRawMaterialMovement(
  input: RawMaterialMovementInput,
): Promise<RawMaterialLedgerEntry> {
  const res = await apiFetch('/raw-material-ledger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { entry?: RawMaterialLedgerEntry; error?: string }
  if (!res.ok || !data.entry) throw new Error(data.error ?? 'Failed to add raw material movement')
  return data.entry
}

export type RawMaterialMovementUpdateInput = Omit<RawMaterialMovementInput, 'raw_mat_id'>

export async function updateRawMaterialMovement(
  id: number,
  input: RawMaterialMovementUpdateInput,
): Promise<RawMaterialLedgerEntry> {
  const res = await apiFetch(`/raw-material-ledger/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { entry?: RawMaterialLedgerEntry; error?: string }
  if (!res.ok || !data.entry) throw new Error(data.error ?? 'Failed to update raw material movement')
  return data.entry
}

// Soft delete -- the row is kept, just flagged inactive (and stamped with
// who did it), so this never shows up in listRawMaterialLedger again.
export async function deleteRawMaterialMovement(id: number): Promise<void> {
  const res = await apiFetch(`/raw-material-ledger/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? 'Failed to delete raw material movement')
  }
}
