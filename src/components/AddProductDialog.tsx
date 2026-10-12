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
import { createProduct, type Product } from '@/lib/products'

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
        suggested_price: suggestedPrice ? Number(suggestedPrice) : null,
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
            <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="suggested_price">Suggested Price</Label>
            <Input
              id="suggested_price"
              type="number"
              min="0"
              value={suggestedPrice}
              onChange={(e) => setSuggestedPrice(e.target.value)}
            />
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
