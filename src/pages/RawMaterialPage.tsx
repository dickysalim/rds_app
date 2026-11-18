import { MoreHorizontal, PrinterIcon } from 'lucide-react'
import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { AppOutletContext } from '@/components/AppLayout'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PdfPreviewFrame } from '@/components/PdfPreviewFrame'
import { Pagination } from '@/components/Pagination'
import { RawMaterialDialog } from '@/components/RawMaterialDialog'
import { RawMaterialHistoryDialog } from '@/components/RawMaterialHistoryDialog'
import { SortableTableHead } from '@/components/SortableTableHead'
import { hideFinancials } from '@/lib/access'
import { formatQty, formatRupiah } from '@/lib/currency'
import type { RawMaterial } from '@/lib/rawMaterial'
import { useBusinessQuery, useDeleteRawMaterialMutation, useRawMaterialLedgerQuery, useRawMaterialsQuery } from '@/lib/queries'
import { previewRawMaterialStockOpnamePdfUrl } from '@/lib/rawMaterialStockOpnamePdf'
import { usePagination } from '@/lib/usePagination'
import { useSort } from '@/lib/useSort'

type RawMaterialSortKey = 'raw_mat_id' | 'raw_mat_sku_name' | 'current_stock'

export function RawMaterialPage() {
  const { user } = useOutletContext<AppOutletContext>()
  const hideCost = hideFinancials(user.role)
  const { data: rawMaterials = [], isLoading: loading } = useRawMaterialsQuery()
  const { data: ledgerEntries = [] } = useRawMaterialLedgerQuery()
  const { data: business } = useBusinessQuery()
  const deleteMutation = useDeleteRawMaterialMutation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRawMaterial, setEditingRawMaterial] = useState<RawMaterial | null>(null)
  const [deletingRawMaterial, setDeletingRawMaterial] = useState<RawMaterial | null>(null)
  const [historyRawMaterial, setHistoryRawMaterial] = useState<RawMaterial | null>(null)
  const [search, setSearch] = useState('')
  const [opnamePdfUrl, setOpnamePdfUrl] = useState<string | null>(null)
  const [opnamePdfLoading, setOpnamePdfLoading] = useState(false)
  const [opnamePdfError, setOpnamePdfError] = useState<string | null>(null)
  const { sortKey, sortDir, toggle, applySort } = useSort<RawMaterial, RawMaterialSortKey>(
    'raw_mat_id',
    'desc',
  )

  function handleSaved() {
    // Mutations already invalidate the shared raw-materials query.
  }

  async function handleDelete() {
    if (!deletingRawMaterial) return
    await deleteMutation.mutateAsync(deletingRawMaterial.raw_mat_id)
    setDeletingRawMaterial(null)
  }

  function closeOpnamePdf() {
    if (opnamePdfUrl) URL.revokeObjectURL(opnamePdfUrl)
    setOpnamePdfUrl(null)
    setOpnamePdfError(null)
  }

  async function handlePrintStockOpname() {
    setOpnamePdfLoading(true)
    setOpnamePdfError(null)
    try {
      if (!business) throw new Error('Set up Business Settings first')
      const url = await previewRawMaterialStockOpnamePdfUrl(rawMaterials, business)
      setOpnamePdfUrl(url)
    } catch (err) {
      setOpnamePdfError(err instanceof Error ? err.message : 'Failed to generate PDF')
    } finally {
      setOpnamePdfLoading(false)
    }
  }

  // Raw Mat. Value = current_stock * price. Not every stock increase has a
  // price (initial counts, unpriced purchase_in rows), so unpriced qty
  // borrows the weighted-average price of the priced increases for that raw
  // material -- flagged "(Est.)" when that happened.
  const valueByRawMat = new Map<number, { avgPrice: number; isEstimated: boolean }>()
  {
    const pricedQtyMap = new Map<number, number>()
    const pricedCostMap = new Map<number, number>()
    const unpricedIncreaseQtyMap = new Map<number, number>()
    for (const entry of ledgerEntries) {
      if (entry.qty <= 0) continue
      if (entry.price != null) {
        pricedQtyMap.set(entry.raw_mat_id, (pricedQtyMap.get(entry.raw_mat_id) ?? 0) + entry.qty)
        pricedCostMap.set(entry.raw_mat_id, (pricedCostMap.get(entry.raw_mat_id) ?? 0) + entry.qty * entry.price)
      } else if (entry.movement_type === 'purchase_in' || entry.movement_type === 'initial_stock') {
        // Only these two are ever supposed to carry a price -- missing one
        // means a real purchase/count went unpriced, so flag it.
        // adjustment_up never has a price by design (it's a recount, not a
        // purchase), so it borrows the average silently without flagging.
        unpricedIncreaseQtyMap.set(entry.raw_mat_id, (unpricedIncreaseQtyMap.get(entry.raw_mat_id) ?? 0) + entry.qty)
      }
    }
    for (const rawMaterial of rawMaterials) {
      const pricedQty = pricedQtyMap.get(rawMaterial.raw_mat_id) ?? 0
      const pricedCost = pricedCostMap.get(rawMaterial.raw_mat_id) ?? 0
      const unpricedIncreaseQty = unpricedIncreaseQtyMap.get(rawMaterial.raw_mat_id) ?? 0
      const avgPrice = pricedQty > 0 ? Math.round(pricedCost / pricedQty) : 0
      valueByRawMat.set(rawMaterial.raw_mat_id, { avgPrice, isEstimated: unpricedIncreaseQty > 0 })
    }
  }

  const filteredRawMaterials = applySort(
    rawMaterials.filter((m) => m.raw_mat_sku_name.toLowerCase().includes(search.trim().toLowerCase())),
    (row, key) => row[key],
  )

  const { page, setPage, pageCount, paged: pagedRawMaterials } = usePagination(filteredRawMaterials)

  const totalRawMatValue = filteredRawMaterials.reduce((sum, m) => {
    const val = valueByRawMat.get(m.raw_mat_id)
    return sum + Math.round(m.current_stock * (val?.avgPrice ?? 0))
  }, 0)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Raw Material</h1>

      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Search raw material name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-80"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrintStockOpname} disabled={opnamePdfLoading}>
            <PrinterIcon />
            {opnamePdfLoading ? 'Generating…' : 'Print Stock Opname'}
          </Button>
          <Button
            onClick={() => {
              setEditingRawMaterial(null)
              setDialogOpen(true)
            }}
          >
            + Add New Raw Material
          </Button>
        </div>
      </div>

      {!hideCost && (
        <div className="w-64 rounded-md border bg-panel p-3 shadow-sm border-[oklch(0.84_0_0)]">
          <p className="text-xs text-muted-foreground">Total Raw Mat. Value</p>
          <p className="text-lg font-semibold text-[#3EA768]">{formatRupiah(totalRawMatValue)}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border bg-panel shadow-sm border-[oklch(0.84_0_0)] [&_tr]:border-[oklch(0.86_0_0)]">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                active={sortKey === 'raw_mat_id'}
                dir={sortDir}
                onClick={() => toggle('raw_mat_id')}
              >
                ID
              </SortableTableHead>
              <SortableTableHead
                active={sortKey === 'raw_mat_sku_name'}
                dir={sortDir}
                onClick={() => toggle('raw_mat_sku_name')}
              >
                Name
              </SortableTableHead>
              <SortableTableHead
                active={sortKey === 'current_stock'}
                dir={sortDir}
                onClick={() => toggle('current_stock')}
                className="w-32 text-left"
              >
                Stock
              </SortableTableHead>
              <TableHead>Unit</TableHead>
              {!hideCost && <TableHead>Unit Price</TableHead>}
              {!hideCost && <TableHead>Raw Mat. Value</TableHead>}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={hideCost ? 5 : 7} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filteredRawMaterials.length === 0 ? (
              <TableRow>
                <TableCell colSpan={hideCost ? 5 : 7} className="text-center text-muted-foreground">
                  {search ? 'No matching raw materials.' : 'No raw materials yet.'}
                </TableCell>
              </TableRow>
            ) : (
              pagedRawMaterials.map((rawMaterial) => {
                const val = valueByRawMat.get(rawMaterial.raw_mat_id)
                const value = Math.round(rawMaterial.current_stock * (val?.avgPrice ?? 0))
                return (
                <TableRow key={rawMaterial.raw_mat_id}>
                  <TableCell>{String(rawMaterial.raw_mat_id).padStart(3, '0')}</TableCell>
                  <TableCell>{rawMaterial.raw_mat_sku_name}</TableCell>
                  <TableCell>{formatQty(rawMaterial.current_stock)}</TableCell>
                  <TableCell>{rawMaterial.unit}</TableCell>
                  {!hideCost && (
                    <TableCell className={`font-medium ${val?.isEstimated ? 'text-amber-700' : 'text-[#3EA768]'}`}>
                      {formatRupiah(val?.avgPrice ?? 0)}
                      {val?.isEstimated ? ' (Est.)' : ''}
                    </TableCell>
                  )}
                  {!hideCost && (
                    <TableCell className={`font-medium ${val?.isEstimated ? 'text-amber-700' : 'text-[#3EA768]'}`}>
                      {formatRupiah(value)}
                      {val?.isEstimated ? ' (Est.)' : ''}
                    </TableCell>
                  )}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingRawMaterial(rawMaterial)
                            setDialogOpen(true)
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setHistoryRawMaterial(rawMaterial)}>
                          History
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeletingRawMaterial(rawMaterial)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />

      <RawMaterialDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rawMaterial={editingRawMaterial}
        onSaved={handleSaved}
        hideCost={hideCost}
      />

      <RawMaterialHistoryDialog
        open={!!historyRawMaterial}
        onOpenChange={(open) => !open && setHistoryRawMaterial(null)}
        rawMatId={historyRawMaterial?.raw_mat_id ?? null}
        rawMatName={historyRawMaterial?.raw_mat_sku_name ?? null}
      />

      <AlertDialog
        open={!!deletingRawMaterial}
        onOpenChange={(open) => !open && setDeletingRawMaterial(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete raw material?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{deletingRawMaterial?.raw_mat_sku_name}" from the raw material list.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={opnamePdfLoading || opnamePdfUrl !== null || opnamePdfError !== null}
        onOpenChange={(open) => !open && closeOpnamePdf()}
      >
        <DialogContent className="flex h-[90vh] max-h-[90vh] max-w-3xl flex-col sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Stock Opname</DialogTitle>
          </DialogHeader>
          {opnamePdfLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Generating…</p>
          ) : opnamePdfError ? (
            <p className="py-8 text-center text-sm text-destructive">{opnamePdfError}</p>
          ) : opnamePdfUrl ? (
            <PdfPreviewFrame
              title="Stock Opname"
              url={opnamePdfUrl}
              frameClassName="w-full rounded-md border"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
