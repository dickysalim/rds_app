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
import { formatQty } from '@/lib/currency'
import type { Product } from '@/lib/products'
import { useCreateStockMovementMutation } from '@/lib/queries'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function AdjustStockDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
}) {
  const [newStock, setNewStock] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const createMutation = useCreateStockMovementMutation()

  useEffect(() => {
    if (open) {
      setNewStock('')
      setNote('')
      setError(null)
    }
  }, [open])

  const currentStock = product?.current_stock ?? 0
  const diff = newStock ? Number(newStock) - currentStock : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!product) return
    if (!diff) {
      setError('New stock must differ from current stock')
      return
    }
    try {
      await createMutation.mutateAsync({
        sku_id: product.sku_id,
        date: today(),
        movement_type: diff > 0 ? 'adjust_up' : 'adjust_down',
        qty: Math.abs(diff),
        note: note.trim() || null,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust stock')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            {product ? `Set the correct stock count for "${product.sku_name}".` : ''}
          </DialogDescription>
        </DialogHeader>
        <form id="adjust-stock-form" className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Current Stock</Label>
            <p className="text-sm text-muted-foreground">{formatQty(currentStock)}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new_stock">New Stock</Label>
            <Input
              id="new_stock"
              inputMode="decimal"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value.replace(/[^0-9.]/g, ''))}
              required
            />
            {newStock && (
              <p className="text-xs text-muted-foreground">
                {diff > 0 ? `Adjust Up by ${formatQty(diff)}` : diff < 0 ? `Adjust Down by ${formatQty(Math.abs(diff))}` : 'No change'}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Input
              id="note"
              placeholder="Reason (recount, damage found, etc.)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </form>
        <DialogFooter>
          <Button type="submit" form="adjust-stock-form" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
