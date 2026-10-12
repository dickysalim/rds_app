import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { createProduct, type Product } from '@/lib/products'

const UNIT_OPTIONS = ['pcs', 'box', 'lusin', 'kodi', 'rim', 'pack', 'kg', 'gram', 'liter', 'meter', 'roll', 'set']

export function AddProductDialog({ onCreated }: { onCreated: (product: Product) => void }) {
  const [open, setOpen] = useState(false)
  const [skuName, setSkuName] = useState('')
  const [unit, setUnit] = useState('')
  const [suggestedPrice, setSuggestedPrice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function reset() {
    setSkuName('')
    setUnit('')
    setSuggestedPrice('')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const product = await createProduct({
        sku_name: skuName,
        unit,
        suggested_price: suggestedPrice ? Number(suggestedPrice.replace(/\D/g, '')) : null,
      })
      onCreated(product)
      setOpen(false)
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button>+ Add New Product</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>Create a new product SKU.</DialogDescription>
        </DialogHeader>
        <form id="add-product-form" className="space-y-4" onSubmit={handleSubmit}>
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
          <Button type="submit" form="add-product-form" disabled={loading}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
