import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
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
import type { AppOutletContext } from '@/components/AppLayout'
import { hideFinancials } from '@/lib/access'
import { formatRupiahInput } from '@/lib/currency'
import { useUpdateRawMaterialMovementMutation } from '@/lib/queries'
import type { RawMaterialLedgerEntry, RawMaterialMovementType } from '@/lib/rawMaterial'

// The option set offered depends on the entry's current sign -- a plus
// movement can only be re-typed as another plus movement, same for minus,
// so an edit can never silently flip the direction of a past movement.
const PLUS_OPTIONS: { value: RawMaterialMovementType; label: string }[] = [
  { value: 'purchase_in', label: 'Purchase In' },
]

const MINUS_OPTIONS: { value: RawMaterialMovementType; label: string }[] = [
  { value: 'out_for_production', label: 'Out for Production' },
  { value: 'retur', label: 'Retur' },
  { value: 'stock_loss', label: 'Stock Loss' },
]

export function EditRawMaterialMovementDialog({
  open,
  onOpenChange,
  entry,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: RawMaterialLedgerEntry | null
}) {
  const { user } = useOutletContext<AppOutletContext>()
  const hideCost = hideFinancials(user.role)
  const options = entry && entry.qty < 0 ? MINUS_OPTIONS : PLUS_OPTIONS
  const [movementType, setMovementType] = useState<RawMaterialMovementType>('purchase_in')
  const [qty, setQty] = useState('')
  const [date, setDate] = useState('')
  const [price, setPrice] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const updateMutation = useUpdateRawMaterialMovementMutation()

  useEffect(() => {
    if (open && entry) {
      setMovementType(entry.movement_type)
      setQty(String(Math.abs(entry.qty)))
      setDate(entry.date.slice(0, 10))
      setPrice(entry.price != null ? formatRupiahInput(String(entry.price)) : '')
      setPoNumber(entry.purchase_order_freetext ?? '')
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
        input: {
          date,
          movement_type: movementType,
          qty: Number(qty),
          note: note.trim() || null,
          price: movementType === 'purchase_in' && price ? Number(price.replace(/\D/g, '')) : null,
          purchase_order_freetext: movementType === 'purchase_in' ? poNumber.trim() || null : null,
        },
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update raw material movement')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Raw Material Movement</DialogTitle>
          <DialogDescription>{entry?.item_name ? `Editing "${entry.item_name}".` : ''}</DialogDescription>
        </DialogHeader>
        <form id="edit-raw-material-movement-form" className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="edit_movement_type">Movement Type</Label>
            <Select
              value={movementType}
              onValueChange={(v) => setMovementType(v as RawMaterialMovementType)}
            >
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
          {movementType === 'purchase_in' && (
            <div className="grid grid-cols-2 gap-4">
              {!hideCost && (
                <div className="space-y-2">
                  <Label htmlFor="edit_price">Price (rate paid)</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      Rp
                    </span>
                    <Input
                      id="edit_price"
                      inputMode="numeric"
                      className="pl-9"
                      value={price}
                      onChange={(e) => setPrice(formatRupiahInput(e.target.value))}
                      maxLength={13}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit_po_number">Purchase Order</Label>
                <Input
                  id="edit_po_number"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="PO number"
                  maxLength={100}
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="edit_note">Note</Label>
            <Input
              id="edit_note"
              placeholder="Reason (vendor, PO ref, etc.)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </form>
        <DialogFooter>
          <Button type="submit" form="edit-raw-material-movement-form" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
