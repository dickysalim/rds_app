import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
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
import type { AppOutletContext } from '@/components/AppLayout'
import { hideFinancials } from '@/lib/access'
import { formatRupiahInput } from '@/lib/currency'
import type { Product, ProductInput } from '@/lib/products'
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
  const { user } = useOutletContext<AppOutletContext>()
  const hideCost = hideFinancials(user.role)
  const [skuName, setSkuName] = useState('')
  const [unit, setUnit] = useState('')
  const [suggestedPrice, setSuggestedPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [currentStock, setCurrentStock] = useState('')
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
      setCostPrice(product?.cost_price != null ? formatRupiahInput(String(product.cost_price)) : '')
      setCurrentStock('')
      setError(null)
    }
  }, [open, product])

  const initialPrice =
    product?.suggested_price != null ? formatRupiahInput(String(product.suggested_price)) : ''
  const initialCost = product?.cost_price != null ? formatRupiahInput(String(product.cost_price)) : ''
  const dirty =
    skuName !== (product?.sku_name ?? '') ||
    unit !== (product?.unit ?? '') ||
    suggestedPrice !== initialPrice ||
    costPrice !== initialCost ||
    currentStock !== ''

  const priceValue = suggestedPrice ? Number(suggestedPrice.replace(/\D/g, '')) : null
  const costValue = costPrice ? Number(costPrice.replace(/\D/g, '')) : null
  const costExceedsPrice = !hideCost && priceValue != null && costValue != null && costValue > priceValue

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
      const input: ProductInput = {
        sku_name: skuName.trim(),
        unit,
        suggested_price: suggestedPrice ? Number(suggestedPrice.replace(/\D/g, '')) : null,
        cost_price: costPrice ? Number(costPrice.replace(/\D/g, '')) : null,
      }
      const saved = product
        ? await updateMutation.mutateAsync({ skuId: product.sku_id, input })
        : await createMutation.mutateAsync({
            ...input,
            initial_stock: currentStock ? Number(currentStock.replace(/\D/g, '')) : null,
          })
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
              maxLength={60}
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
            <Label htmlFor="suggested_price">Price</Label>
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
                maxLength={13}
              />
            </div>
          </div>
          {!hideCost && (
            <div className="space-y-2">
              <Label htmlFor="cost_price">Cost</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  Rp
                </span>
                <Input
                  id="cost_price"
                  inputMode="numeric"
                  className="pl-9"
                  value={costPrice}
                  onChange={(e) => setCostPrice(formatRupiahInput(e.target.value))}
                  maxLength={13}
                />
              </div>
              {costExceedsPrice && (
                <p className="text-destructive text-sm">Cost cannot exceed the price</p>
              )}
            </div>
          )}
          {!product && (
            <div className="space-y-2">
              <Label htmlFor="current_stock">Current Stock</Label>
              <Input
                id="current_stock"
                inputMode="numeric"
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
        </form>
        <DialogFooter>
          <Button type="submit" form="product-form" disabled={loading || costExceedsPrice}>
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
