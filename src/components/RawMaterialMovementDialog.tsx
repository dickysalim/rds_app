import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RawMaterialCombobox } from '@/components/RawMaterialCombobox'
import { formatQty } from '@/lib/currency'
import type { RawMaterialMovementType } from '@/lib/rawMaterial'
import { useCreateRawMaterialMovementMutation, useRawMaterialsQuery } from '@/lib/queries'

// purchase_in/initial_stock are created elsewhere (PurchaseOrderPanel, raw
// material creation) -- this dialog covers manual stock-out and the
// adjustment_up/down correction types in both directions.
const ADD_OPTIONS: { value: Extract<RawMaterialMovementType, 'adjustment_up'>; label: string }[] = [
  { value: 'adjustment_up', label: 'Adjustment Up' },
]

const DEDUCT_OPTIONS: {
  value: Exclude<RawMaterialMovementType, 'purchase_in' | 'initial_stock' | 'adjustment_up'>
  label: string
}[] = [
  { value: 'out_for_production', label: 'Out for Production' },
  { value: 'retur', label: 'Retur' },
  { value: 'stock_loss', label: 'Stock Loss' },
  { value: 'adjustment_down', label: 'Adjustment Down' },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function RawMaterialMovementDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: rawMaterials = [] } = useRawMaterialsQuery()
  const [rawMatId, setRawMatId] = useState<number | null>(null)
  const [date, setDate] = useState(today())
  const [direction, setDirection] = useState<'add' | 'deduct'>('deduct')
  const [movementType, setMovementType] = useState<
    typeof ADD_OPTIONS[number]['value'] | typeof DEDUCT_OPTIONS[number]['value']
  >(DEDUCT_OPTIONS[0].value)
  const options = direction === 'add' ? ADD_OPTIONS : DEDUCT_OPTIONS
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const createMutation = useCreateRawMaterialMovementMutation()

  const selectedRawMaterial = rawMaterials.find((m) => m.raw_mat_id === rawMatId) ?? null
  const currentStock = selectedRawMaterial?.current_stock ?? 0
  const qtyNum = Number(qty) || 0
  const exceedsStock = direction === 'deduct' && !!rawMatId && qtyNum > currentStock

  useEffect(() => {
    if (open) {
      setRawMatId(null)
      setDate(today())
      setDirection('deduct')
      setMovementType(DEDUCT_OPTIONS[0].value)
      setQty('')
      setNote('')
      setError(null)
    }
  }, [open])

  function handleDirectionChange(next: 'add' | 'deduct') {
    setDirection(next)
    setMovementType(next === 'add' ? ADD_OPTIONS[0].value : DEDUCT_OPTIONS[0].value)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!rawMatId) {
      setError('Select a raw material')
      return
    }
    if (exceedsStock) {
      setError(`Not enough stock: only ${formatQty(currentStock)} available`)
      return
    }
    try {
      await createMutation.mutateAsync({
        raw_mat_id: rawMatId,
        date,
        movement_type: movementType,
        qty: Number(qty),
        note: note.trim() || null,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add raw material movement')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Raw Material</DialogTitle>
          <DialogDescription>Record stock going out, or correct a miscounted balance.</DialogDescription>
        </DialogHeader>
        <form id="raw-material-movement-form" className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="raw_mat_id">Raw Material</Label>
            <RawMaterialCombobox rawMaterials={rawMaterials} value={rawMatId} onChange={setRawMatId} />
            {selectedRawMaterial && (
              <p className="text-xs text-muted-foreground">
                Current stock: {formatQty(currentStock)}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="direction">Direction</Label>
            <Select value={direction} onValueChange={(v) => handleDirectionChange(v as 'add' | 'deduct')}>
              <SelectTrigger id="direction" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deduct">Deduct</SelectItem>
                <SelectItem value="add">Add</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="movement_type">Movement Type</Label>
            <Select value={movementType} onValueChange={(v) => setMovementType(v as typeof movementType)}>
              <SelectTrigger id="movement_type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qty">Qty</Label>
              <Input
                id="qty"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ''))}
                required
              />
              {exceedsStock && (
                <p className="text-xs text-destructive">
                  Only {formatQty(currentStock)} available
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Input
              id="note"
              placeholder="Reason (vendor, PO ref, etc.)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </form>
        <DialogFooter>
          <Button
            type="submit"
            form="raw-material-movement-form"
            disabled={createMutation.isPending || exceedsStock}
          >
            {createMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
