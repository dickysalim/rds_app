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
import { RawMaterialCombobox } from '@/components/RawMaterialCombobox'
import { formatQty } from '@/lib/currency'
import { useCreateRawMaterialMovementMutation, useRawMaterialsQuery } from '@/lib/queries'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function AdjustRawMaterialDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: rawMaterials = [] } = useRawMaterialsQuery()
  const [rawMatId, setRawMatId] = useState<number | null>(null)
  const [newStock, setNewStock] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const createMutation = useCreateRawMaterialMovementMutation()

  useEffect(() => {
    if (open) {
      setRawMatId(null)
      setNewStock('')
      setNote('')
      setError(null)
    }
  }, [open])

  const selectedRawMaterial = rawMaterials.find((m) => m.raw_mat_id === rawMatId) ?? null
  const currentStock = selectedRawMaterial?.current_stock ?? 0
  const diff = newStock ? Number(newStock) - currentStock : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!selectedRawMaterial) {
      setError('Select a raw material')
      return
    }
    if (!diff) {
      setError('New stock must differ from current stock')
      return
    }
    try {
      await createMutation.mutateAsync({
        raw_mat_id: selectedRawMaterial.raw_mat_id,
        date: today(),
        movement_type: diff > 0 ? 'adjustment_up' : 'adjustment_down',
        qty: Math.abs(diff),
        note: note.trim() || null,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust raw material')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Raw Material</DialogTitle>
          <DialogDescription>
            {selectedRawMaterial
              ? `Set the correct stock count for "${selectedRawMaterial.raw_mat_sku_name}".`
              : 'Pick a raw material to adjust its stock count.'}
          </DialogDescription>
        </DialogHeader>
        <form id="adjust-raw-material-form" className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="raw_mat_id">Raw Material</Label>
            <RawMaterialCombobox rawMaterials={rawMaterials} value={rawMatId} onChange={setRawMatId} />
          </div>
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
              disabled={!selectedRawMaterial}
              required
            />
            <p className={`text-xs ${diff > 0 ? 'text-[#3EA768]' : diff < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
              {newStock
                ? diff > 0
                  ? `Adjust Up by ${formatQty(diff)}`
                  : diff < 0
                    ? `Adjust Down by ${formatQty(Math.abs(diff))}`
                    : 'No change'
                : ' '}
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
          <Button type="submit" form="adjust-raw-material-form" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
