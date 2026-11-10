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
import { useUpdateStockMovementMutation } from '@/lib/queries'
import type { StockLedgerEntry, StockMovementType } from '@/lib/stockLedger'

// The option set offered depends on the entry's current sign -- a plus
// movement can only be re-typed as another plus movement, same for minus,
// so an edit can never silently flip the direction of a past movement.
const PLUS_OPTIONS: { value: StockMovementType; label: string }[] = [
  { value: 'production_in', label: 'Production In' },
  { value: 'shipment_return', label: 'Shipment Return' },
  { value: 'adjust_up', label: 'Adjust Up' },
]

const MINUS_OPTIONS: { value: StockMovementType; label: string }[] = [
  { value: 'stock_out', label: 'Stock Out' },
  { value: 'stock_defect', label: 'Stock Defect' },
  { value: 'stock_loss', label: 'Stock Loss' },
  { value: 'adjust_down', label: 'Adjust Down' },
]

export function EditStockMovementDialog({
  open,
  onOpenChange,
  entry,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: StockLedgerEntry | null
}) {
  const options = entry && entry.qty < 0 ? MINUS_OPTIONS : PLUS_OPTIONS
  const [movementType, setMovementType] = useState<StockMovementType>('production_in')
  const [qty, setQty] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const updateMutation = useUpdateStockMovementMutation()

  useEffect(() => {
    if (open && entry) {
      setMovementType(entry.movement_type as StockMovementType)
      setQty(String(Math.abs(entry.qty)))
      setDate(entry.date.slice(0, 10))
      setNote(entry.note ?? '')
      setError(null)
    }
  }, [open, entry])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!entry) return
    try {
      await updateMutation.mutateAsync({
        id: entry.id,
        input: { date, movement_type: movementType, qty: Number(qty), note: note.trim() || null },
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update stock movement')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Stock Movement</DialogTitle>
          <DialogDescription>{entry?.item_name ? `Editing "${entry.item_name}".` : ''}</DialogDescription>
        </DialogHeader>
        <form id="edit-stock-movement-form" className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="edit_movement_type">Movement Type</Label>
            <Select value={movementType} onValueChange={(v) => setMovementType(v as StockMovementType)}>
              <SelectTrigger id="edit_movement_type" className="w-full">
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
              <Label htmlFor="edit_qty">Qty</Label>
              <Input
                id="edit_qty"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ''))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_date">Date</Label>
              <Input id="edit_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_note">Note</Label>
            <Input
              id="edit_note"
              placeholder="Reason (damage, recount, PO ref, etc.)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </form>
        <DialogFooter>
          <Button type="submit" form="edit-stock-movement-form" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
