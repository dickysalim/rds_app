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
import type { RawMaterial } from '@/lib/rawMaterial'
import { useCreateRawMaterialMutation, useUpdateRawMaterialMutation } from '@/lib/queries'

const UNIT_OPTIONS = ['pcs', 'box', 'lusin', 'kodi', 'rim', 'pack', 'kg', 'gram', 'liter', 'meter', 'roll', 'set', 'lembar', 'batang', 'kaleng', 'drum']

export function RawMaterialDialog({
  open,
  onOpenChange,
  rawMaterial,
  onSaved,
  hideCost = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rawMaterial: RawMaterial | null
  onSaved: (rawMaterial: RawMaterial) => void
  hideCost?: boolean
}) {
  const [skuName, setSkuName] = useState('')
  const [unit, setUnit] = useState('')
  const [currentStock, setCurrentStock] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const createMutation = useCreateRawMaterialMutation()
  const updateMutation = useUpdateRawMaterialMutation()
  const loading = createMutation.isPending || updateMutation.isPending

  useEffect(() => {
    if (open) {
      setSkuName(rawMaterial?.raw_mat_sku_name ?? '')
      setUnit(rawMaterial?.unit ?? '')
      setCurrentStock('')
      setCurrentPrice('')
      setError(null)
    }
  }, [open, rawMaterial])

  const dirty =
    skuName !== (rawMaterial?.raw_mat_sku_name ?? '') ||
    unit !== (rawMaterial?.unit ?? '') ||
    currentStock !== '' ||
    currentPrice !== ''

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
      const saved = rawMaterial
        ? await updateMutation.mutateAsync({
            rawMatId: rawMaterial.raw_mat_id,
            input: { raw_mat_sku_name: skuName.trim(), unit },
          })
        : await createMutation.mutateAsync({
            raw_mat_sku_name: skuName.trim(),
            unit,
            initial_stock: currentStock ? Number(currentStock.replace(/\D/g, '')) : null,
            current_price: currentPrice ? Number(currentPrice.replace(/\D/g, '')) : null,
          })
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save raw material')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rawMaterial ? 'Edit Raw Material' : 'Add New Raw Material'}</DialogTitle>
          <DialogDescription>
            {rawMaterial ? 'Update this raw material.' : 'Create a new raw material.'}
          </DialogDescription>
        </DialogHeader>
        <form id="raw-material-form" className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="raw_mat_sku_name">Name</Label>
            <Input
              id="raw_mat_sku_name"
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
          {!rawMaterial && (
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
          {!rawMaterial && !hideCost && (
            <div className="space-y-2">
              <Label htmlFor="current_price">Current Price / Unit</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  Rp
                </span>
                <Input
                  id="current_price"
                  inputMode="numeric"
                  className="pl-9"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(formatRupiahInput(e.target.value))}
                  maxLength={13}
                />
              </div>
            </div>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
        </form>
        <DialogFooter>
          <Button type="submit" form="raw-material-form" disabled={loading}>
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
