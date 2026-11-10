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
import { ProductCombobox } from '@/components/ProductCombobox'
import { formatQty } from '@/lib/currency'
import type { Product } from '@/lib/products'
import { useCreateStockMovementMutation, useProductsQuery } from '@/lib/queries'

function today() {
  return new Date().toISOString().slice(0, 10)
}

// `product` omitted entirely (undefined) -> picker mode: an Item select is
// shown and the product is looked up from the products list. `product`
// passed (even null, e.g. while the dialog is closed) -> preselected mode,
// used from a product row's own "Adjust Stock" action.
export function AdjustStockDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product | null
}) {
  const pickerMode = product === undefined
  const { data: products = [] } = useProductsQuery()
  const [skuId, setSkuId] = useState<number | null>(null)
  const [newStock, setNewStock] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const createMutation = useCreateStockMovementMutation()

  useEffect(() => {
    if (open) {
      setSkuId(null)
      setNewStock('')
      setNote('')
      setError(null)
    }
  }, [open])

  const selectedProduct = pickerMode ? (products.find((p) => p.sku_id === skuId) ?? null) : product
  const currentStock = selectedProduct?.current_stock ?? 0
  const diff = newStock ? Number(newStock) - currentStock : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!selectedProduct) return
    if (!diff) {
      setError('New stock must differ from current stock')
      return
    }
    try {
      await createMutation.mutateAsync({
        sku_id: selectedProduct.sku_id,
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
          <DialogTitle>Adjust Product</DialogTitle>
          <DialogDescription>
            {selectedProduct
              ? `Set the correct stock count for "${selectedProduct.sku_name}".`
              : pickerMode
                ? 'Pick an item to adjust its stock count.'
                : ''}
          </DialogDescription>
        </DialogHeader>
        <form id="adjust-stock-form" className="space-y-4" onSubmit={handleSubmit}>
          {pickerMode && (
            <div className="space-y-2">
              <Label htmlFor="sku_id">Item</Label>
              <ProductCombobox products={products} value={skuId} onChange={setSkuId} />
            </div>
          )}
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
              disabled={pickerMode && !selectedProduct}
              required
            />
            <p className={`text-xs ${diff > 0 ? 'text-[#3EA768]' : diff < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
              {newStock
                ? diff > 0
                  ? `Adjust Up by ${formatQty(diff)}`
                  : diff < 0
                    ? `Adjust Down by ${formatQty(Math.abs(diff))}`
                    : 'No change'
                : ' '}
            </p>
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
