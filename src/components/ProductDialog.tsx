import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import type { Product } from '@/lib/products'
import { useCreateProductMutation, useUpdateProductMutation } from '@/lib/queries'

const UNIT_OPTIONS = ['pcs', 'box', 'lusin', 'kodi', 'rim', 'pack', 'kg', 'gram', 'liter', 'meter', 'roll', 'set', 'lembar', 'batang', 'kaleng', 'drum']

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
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const createMutation = useCreateProductMutation()
  const updateMutation = useUpdateProductMutation()
  const loading = createMutation.isPending || updateMutation.isPending

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

  const initialPrice =
    product?.suggested_price != null ? formatRupiahInput(String(product.suggested_price)) : ''
  const dirty =
    skuName !== (product?.sku_name ?? '') ||
    unit !== (product?.unit ?? '') ||
    suggestedPrice !== initialPrice

  function handleOpenChange(next: boolean) {
    if (!next && dirty && !loading) {
      setConfirmDiscard(true)
      return
    }
    onOpenChange(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const input = {
        sku_name: skuName.trim(),
        unit,
        suggested_price: suggestedPrice ? Number(suggestedPrice.replace(/\D/g, '')) : null,
      }
      const saved = product
        ? await updateMutation.mutateAsync({ skuId: product.sku_id, input })
        : await createMutation.mutateAsync(input)
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. If you leave now, they will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscard(false)
                onOpenChange(false)
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
