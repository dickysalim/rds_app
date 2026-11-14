import { ArrowLeft, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AppOutletContext } from '@/components/AppLayout'
import { hideFinancials } from '@/lib/access'
import { formatQty, formatRupiah, formatRupiahInput } from '@/lib/currency'
import { UNITS } from '@/lib/nota'
import type { PurchaseOrderInput } from '@/lib/purchaseOrders'
import type { RawMaterial } from '@/lib/rawMaterial'
import { useCreatePurchaseOrderMutation, useRawMaterialsQuery } from '@/lib/queries'

function toNumber(formatted: string): number {
  return Number(formatted.replace(/\D/g, '')) || 0
}

interface ItemRow {
  key: string
  rawMatQuery: string
  rawMatId: number | null
  unit: string
  priceDisplay: string
  qty: string
  note: string
  showSuggestions: boolean
  highlightedIndex: number
}

function newRow(): ItemRow {
  return {
    key: crypto.randomUUID(),
    rawMatQuery: '',
    rawMatId: null,
    unit: '',
    priceDisplay: '',
    qty: '',
    note: '',
    showSuggestions: false,
    highlightedIndex: -1,
  }
}

function subtotalOf(row: ItemRow): number {
  return toNumber(row.priceDisplay) * (Number(row.qty) || 0)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function PurchaseOrderPanel({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const { user } = useOutletContext<AppOutletContext>()
  const hideCost = hideFinancials(user.role)
  const { data: rawMaterials = [] } = useRawMaterialsQuery()
  const createMutation = useCreatePurchaseOrderMutation()

  const [poDate, setPoDate] = useState(today())
  const [poNumber, setPoNumber] = useState('')
  const [items, setItems] = useState<ItemRow[]>([newRow()])
  const [error, setError] = useState<string | null>(null)
  const rawMatInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function updateItem(key: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function handleAddItem() {
    const row = newRow()
    setItems((prev) => [...prev, row])
    requestAnimationFrame(() => rawMatInputRefs.current[row.key]?.focus())
  }

  function handlePickRawMaterial(key: string, rawMaterial: RawMaterial) {
    setItems((prev) =>
      prev.map((row) =>
        row.key === key
          ? {
              ...row,
              rawMatQuery: rawMaterial.raw_mat_sku_name,
              rawMatId: rawMaterial.raw_mat_id,
              unit: rawMaterial.unit,
              showSuggestions: false,
              highlightedIndex: -1,
            }
          : row,
      ),
    )
  }

  const grandTotal = items.reduce((sum, row) => sum + subtotalOf(row), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (items.length === 0 || items.some((row) => !row.rawMatQuery.trim() || !row.unit || !row.qty)) {
      setError('Every item needs a raw material, unit and qty')
      return
    }

    const input: PurchaseOrderInput = {
      po_date: poDate,
      po_number: poNumber.trim() || null,
      items: items.map((row) => ({
        raw_mat_id: row.rawMatId,
        raw_mat_sku_name: row.rawMatQuery.trim(),
        unit: row.unit,
        qty: Number(row.qty),
        price: row.priceDisplay ? toNumber(row.priceDisplay) : null,
        note: row.note.trim() || null,
      })),
    }

    try {
      await createMutation.mutateAsync(input)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase order')
    }
  }

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="-ml-2">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add Raw Material</h1>
          <p className="text-sm text-muted-foreground">Create a purchase order and its raw material items.</p>
        </div>
        <Button type="submit" form="purchase-order-form" size="lg" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <form id="purchase-order-form" className="space-y-8" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="po_date">Date</Label>
            <Input id="po_date" type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="po_number">Purchase Order</Label>
            <Input
              id="po_number"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="PO number"
              maxLength={100}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="font-bold">Raw Material Item</Label>
          <div className="rounded-xl border border-[oklch(0.75_0_0)] bg-panel shadow-sm">
            <div className="hidden gap-2 rounded-t-xl border-b border-[oklch(0.75_0_0)] bg-panel px-3 pb-3 pt-2 text-xs font-semibold text-black sm:grid sm:grid-cols-[minmax(0,1.1fr)_6rem_5.5rem_9rem_1fr_2.25rem]">
              <span>Raw Material</span>
              <span>Unit</span>
              <span>Qty</span>
              {!hideCost ? <span>Price</span> : <span />}
              <span>Note</span>
              <span />
            </div>
            <div className="pt-2">
              {items.map((row) => {
                const usedRawMatIds = new Set(
                  items.filter((r) => r.key !== row.key && r.rawMatId !== null).map((r) => r.rawMatId),
                )
                const filteredRawMaterials = rawMaterials
                  .filter(
                    (m) =>
                      m.raw_mat_sku_name.toLowerCase().includes(row.rawMatQuery.toLowerCase()) &&
                      !usedRawMatIds.has(m.raw_mat_id),
                  )
                  .slice(0, 5)
                const lockedByRawMat = row.rawMatId !== null
                const cellInputClass = 'min-w-0 bg-white'
                return (
                  <div
                    key={row.key}
                    className="grid grid-cols-1 gap-2 bg-panel p-2 sm:grid-cols-[minmax(0,1.1fr)_6rem_5.5rem_9rem_1fr_2.25rem] sm:items-start sm:px-3 sm:py-1.5"
                  >
                    <div className="relative min-w-0">
                      <Input
                        ref={(el) => {
                          rawMatInputRefs.current[row.key] = el
                        }}
                        className={cellInputClass}
                        value={row.rawMatQuery}
                        onChange={(e) => {
                          const typed = e.target.value
                          const exact = rawMaterials.find(
                            (m) => m.raw_mat_sku_name.trim().toLowerCase() === typed.trim().toLowerCase(),
                          )
                          if (exact) {
                            handlePickRawMaterial(row.key, exact)
                            return
                          }
                          updateItem(row.key, {
                            rawMatQuery: typed,
                            rawMatId: null,
                            showSuggestions: true,
                            highlightedIndex: -1,
                          })
                        }}
                        onFocus={() => updateItem(row.key, { showSuggestions: true })}
                        onBlur={() => setTimeout(() => updateItem(row.key, { showSuggestions: false }), 100)}
                        onKeyDown={(e) => {
                          if (!row.showSuggestions || filteredRawMaterials.length === 0) return
                          if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            updateItem(row.key, {
                              highlightedIndex: Math.min(
                                row.highlightedIndex + 1,
                                filteredRawMaterials.length - 1,
                              ),
                            })
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            updateItem(row.key, { highlightedIndex: Math.max(row.highlightedIndex - 1, 0) })
                          } else if (e.key === 'Enter') {
                            if (row.highlightedIndex >= 0) {
                              e.preventDefault()
                              handlePickRawMaterial(row.key, filteredRawMaterials[row.highlightedIndex])
                            }
                          } else if (e.key === 'Escape') {
                            updateItem(row.key, { showSuggestions: false })
                          }
                        }}
                        placeholder="Type or pick a raw material"
                        autoComplete="off"
                      />
                      {row.showSuggestions && row.rawMatQuery && filteredRawMaterials.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                          {filteredRawMaterials.map((m, idx) => (
                            <button
                              key={m.raw_mat_id}
                              type="button"
                              className={`block w-full px-3 py-2 text-left text-sm hover:bg-accent ${
                                idx === row.highlightedIndex ? 'bg-accent' : ''
                              }`}
                              onMouseDown={(e) => e.preventDefault()}
                              onMouseEnter={() => updateItem(row.key, { highlightedIndex: idx })}
                              onClick={() => handlePickRawMaterial(row.key, m)}
                            >
                              {m.raw_mat_sku_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Select
                      value={row.unit}
                      onValueChange={(value) => updateItem(row.key, { unit: value })}
                      disabled={lockedByRawMat}
                    >
                      <SelectTrigger
                        className={`${cellInputClass} w-full disabled:bg-[oklch(0.9_0_0)] disabled:opacity-100`}
                      >
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {(row.unit && !(UNITS as readonly string[]).includes(row.unit)
                          ? [...UNITS, row.unit]
                          : UNITS
                        ).map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="min-w-0">
                      <Input
                        className={cellInputClass}
                        inputMode="decimal"
                        value={row.qty}
                        onChange={(e) =>
                          updateItem(row.key, { qty: e.target.value.replace(/[^0-9.]/g, '') })
                        }
                      />
                      {row.rawMatId != null && (
                        <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
                          Stock: {formatQty(rawMaterials.find((m) => m.raw_mat_id === row.rawMatId)?.current_stock ?? 0)}
                        </p>
                      )}
                    </div>
                    {!hideCost ? (
                      <div className="relative min-w-0">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          Rp
                        </span>
                        <Input
                          className={`${cellInputClass} pl-7`}
                          inputMode="numeric"
                          value={row.priceDisplay}
                          onChange={(e) =>
                            updateItem(row.key, { priceDisplay: formatRupiahInput(e.target.value) })
                          }
                        />
                      </div>
                    ) : (
                      <div />
                    )}
                    <Input
                      className={cellInputClass}
                      value={row.note}
                      onChange={(e) => updateItem(row.key, { note: e.target.value })}
                      maxLength={200}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      tabIndex={-1}
                      className="h-9 w-9 shrink-0 justify-self-end sm:justify-self-auto"
                      disabled={items.length === 1}
                      onClick={() => setItems((prev) => prev.filter((r) => r.key !== row.key))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
            <div className="rounded-b-xl border-t border-[oklch(0.75_0_0)] bg-panel p-2">
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                + Add Item
              </Button>
            </div>
          </div>
        </div>

        {!hideCost && (
          <div className="flex justify-end text-sm font-medium">Total: {formatRupiah(grandTotal)}</div>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}
      </form>
    </div>
  )
}
