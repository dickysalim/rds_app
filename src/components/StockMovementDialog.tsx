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
import { ProductCombobox } from '@/components/ProductCombobox'
import { formatQty } from '@/lib/currency'
import { useCreateStockMovementMutation, useProductsQuery } from '@/lib/queries'

// adjust_up/adjust_down are not offered here -- they're only produced by
// AdjustStockDialog, which derives the sign from a current-vs-new-stock diff.
const ADD_OPTIONS: { value: 'production_in' | 'shipment_return'; label: string }[] = [
  { value: 'production_in', label: 'Production In' },
  { value: 'shipment_return', label: 'Shipment Return' },
]

const DEDUCT_OPTIONS: { value: 'stock_out' | 'stock_defect' | 'stock_loss'; label: string }[] = [
  { value: 'stock_out', label: 'Stock Out' },
  { value: 'stock_defect', label: 'Stock Defect' },
  { value: 'stock_loss', label: 'Stock Loss' },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function StockMovementDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'add' | 'deduct'
}) {
  const options = mode === 'add' ? ADD_OPTIONS : DEDUCT_OPTIONS
  const { data: products = [] } = useProductsQuery()
  const [skuId, setSkuId] = useState<number | null>(null)
  const [date, setDate] = useState(today())
  const [movementType, setMovementType] = useState<typeof options[number]['value']>(options[0].value)
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const createMutation = useCreateStockMovementMutation()

  const selectedProduct = products.find((p) => p.sku_id === skuId) ?? null
  const currentStock = selectedProduct?.current_stock ?? 0
  const qtyNum = Number(qty) || 0
  const exceedsStock = mode === 'deduct' && !!skuId && qtyNum > currentStock

  useEffect(() => {
    if (open) {
      setSkuId(null)
      setDate(today())
      setMovementType(options[0].value)
      setQty('')
      setNote('')
      setError(null)
    }
  }, [open, mode])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!skuId) {
      setError('Select an item')
      return
    }
    if (exceedsStock) {
      setError(`Not enough stock: only ${formatQty(currentStock)} available`)
      return
    }
    try {
      await createMutation.mutateAsync({
        sku_id: skuId,
        date,
        movement_type: movementType,
        qty: Number(qty),
        note: note.trim() || null,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add stock movement')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Add Product' : 'Deduct Product'}</DialogTitle>
          <DialogDescription>
            {mode === 'add' ? 'Record stock coming in.' : 'Record stock going out.'}
          </DialogDescription>
        </DialogHeader>
        <form id="stock-movement-form" className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="sku_id">Item</Label>
            <ProductCombobox products={products} value={skuId} onChange={setSkuId} />
            {mode === 'deduct' && selectedProduct && (
              <p className="text-xs text-muted-foreground">
                Current stock: {formatQty(currentStock)}
              </p>
            )}
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
              placeholder="Reason (damage, recount, PO ref, etc.)"
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
            form="stock-movement-form"
            disabled={createMutation.isPending || exceedsStock}
          >
            {createMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
