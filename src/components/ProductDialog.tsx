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
import { formatRupiahInput } from '@/lib/currency'
import { createProduct, updateProduct, type Product } from '@/lib/products'

const UNIT_OPTIONS = ['pcs', 'box', 'lusin', 'kodi', 'rim', 'pack', 'kg', 'gram', 'liter', 'meter', 'roll', 'set']

export function ProductDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSaved: (product: Product) => void
}) {
  const [skuName, setSkuName] = useState('')
  const [unit, setUnit] = useState('')
  const [suggestedPrice, setSuggestedPrice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setSkuName(product?.sku_name ?? '')
      setUnit(product?.unit ?? '')
      setSuggestedPrice(
        product?.suggested_price != null ? formatRupiahInput(String(product.suggested_price)) : '',
      )
      setError(null)
    }
  }, [open, product])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const input = {
        sku_name: skuName,
        unit,
        suggested_price: suggestedPrice ? Number(suggestedPrice.replace(/\D/g, '')) : null,
      }
      const saved = product ? await updateProduct(product.sku_id, input) : await createProduct(input)
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          <DialogDescription>
            {product ? 'Update this product SKU.' : 'Create a new product SKU.'}
          </DialogDescription>
        </DialogHeader>
        <form id="product-form" className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="sku_name">SKU Name</Label>
            <Input
              id="sku_name"
              value={skuName}
              onChange={(e) => setSkuName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Select value={unit} onValueChange={setUnit} required>
              <SelectTrigger id="unit" className="w-full">
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="suggested_price">Suggested Price</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <Input
                id="suggested_price"
                inputMode="numeric"
                className="pl-9"
                value={suggestedPrice}
                onChange={(e) => setSuggestedPrice(formatRupiahInput(e.target.value))}
              />
            </div>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </form>
        <DialogFooter>
          <Button type="submit" form="product-form" disabled={loading}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
