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
import { Textarea } from '@/components/ui/textarea'
import { formatRupiahInput } from '@/lib/currency'
import { useUpdateRawMaterialMovementMutation } from '@/lib/queries'
import type { RawMaterialLedgerEntry } from '@/lib/rawMaterial'

// Price Management only ever edits purchase_in rows that are missing a
// price, so this skips movement type / date / note -- just the price (and
// qty, in case the PO quantity was wrong when the price was filled in).
export function EditRawMaterialPriceDialog({
  open,
  onOpenChange,
  entry,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: RawMaterialLedgerEntry | null
}) {
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const updateMutation = useUpdateRawMaterialMovementMutation()

  useEffect(() => {
    if (open && entry) {
      setQty(String(Math.abs(entry.qty)))
      setPrice(entry.price != null ? formatRupiahInput(String(entry.price)) : '')
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
          date: entry.date.slice(0, 10),
          movement_type: entry.movement_type,
          qty: Number(qty),
          note: note.trim() ? note.trim() : null,
          price: price ? Number(price.replace(/\D/g, '')) : null,
          purchase_order_freetext: entry.purchase_order_freetext,
        },
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update price')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Price</DialogTitle>
          <DialogDescription>{entry?.item_name ? `Editing "${entry.item_name}".` : ''}</DialogDescription>
        </DialogHeader>
        <form id="edit-raw-material-price-form" className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <Label>Item</Label>
            <p className="text-sm">{entry?.item_name ?? '-'}</p>
          </div>
          <div className="space-y-1">
            <Label>Purchase Order</Label>
            <p className="text-sm">
              {entry?.movement_type === 'initial_stock' ? 'Initial Stock' : (entry?.purchase_order_freetext ?? '-')}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="price_qty">Qty</Label>
            <Input
              id="price_qty"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ''))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price_price">Price</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <Input
                id="price_price"
                inputMode="numeric"
                className="pl-9"
                value={price}
                onChange={(e) => setPrice(formatRupiahInput(e.target.value))}
                maxLength={13}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="price_note">Note</Label>
            <Textarea id="price_note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </form>
        <DialogFooter>
          <Button type="submit" form="edit-raw-material-price-form" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
