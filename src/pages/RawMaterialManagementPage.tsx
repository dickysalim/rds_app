import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AppOutletContext } from '@/components/AppLayout'
import { EditRawMaterialMovementDialog } from '@/components/EditRawMaterialMovementDialog'
import { Pagination } from '@/components/Pagination'
import { PurchaseOrderPanel } from '@/components/PurchaseOrderPanel'
import { RawMaterialMovementDialog } from '@/components/RawMaterialMovementDialog'
import { hideFinancials } from '@/lib/access'
import { formatQty, formatRupiah } from '@/lib/currency'
import { useDeleteRawMaterialMovementMutation, useRawMaterialLedgerQuery } from '@/lib/queries'
import type { RawMaterialLedgerEntry } from '@/lib/rawMaterial'
import { usePagination } from '@/lib/usePagination'

const MOVEMENT_LABEL: Record<string, string> = {
  purchase_in: 'Purchase In',
  out_for_production: 'Out for Production',
  retur: 'Retur',
  stock_loss: 'Stock Loss',
}

function formatBusinessDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function RawMaterialManagementPage() {
  const { user } = useOutletContext<AppOutletContext>()
  const hideCost = hideFinancials(user.role)
  const { data: entries = [], isLoading: loading } = useRawMaterialLedgerQuery()
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'list' | 'add'>('list')
  const [deductDialogOpen, setDeductDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<RawMaterialLedgerEntry | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<RawMaterialLedgerEntry | null>(null)
  const deleteMutation = useDeleteRawMaterialMovementMutation()

  async function handleDelete() {
    if (!deletingEntry) return
    await deleteMutation.mutateAsync(deletingEntry.id)
    setDeletingEntry(null)
  }

  const filteredEntries = entries
    .filter((entry) => (entry.item_name ?? '-').toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date))

  const { page, setPage, pageCount, paged: pagedEntries } = usePagination(filteredEntries)

  if (view === 'add') {
    return (
      <PurchaseOrderPanel
        onCancel={() => setView('list')}
        onSaved={() => setView('list')}
      />
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Raw Mat. Management</h1>

      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Search raw material name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-80"
        />
        <div className="flex gap-2">
          <Button className="bg-[#3EA768] text-white hover:bg-[#357f52]" onClick={() => setView('add')}>
            + Add Raw Material
          </Button>
          <Button className="bg-red-600 text-white hover:bg-red-700" onClick={() => setDeductDialogOpen(true)}>
            - Deduct Raw Material
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border bg-panel shadow-sm border-[oklch(0.84_0_0)] [&_tr]:border-[oklch(0.86_0_0)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-bold">Business Date</TableHead>
              <TableHead className="font-bold">Raw Material</TableHead>
              <TableHead className="font-bold">Movement Type</TableHead>
              <TableHead className="font-bold">Qty</TableHead>
              {!hideCost && <TableHead className="font-bold">Price</TableHead>}
              <TableHead className="font-bold">Purchase Order</TableHead>
              <TableHead className="font-bold">Created By</TableHead>
              <TableHead className="font-bold">Note</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={hideCost ? 8 : 9} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={hideCost ? 8 : 9} className="text-center text-muted-foreground">
                  {search ? 'No matching raw material movements.' : 'No raw material movements yet.'}
                </TableCell>
              </TableRow>
            ) : (
              pagedEntries.map((entry) => (
                <TableRow key={entry.id} className={entry.qty < 0 ? 'bg-red-50' : 'bg-green-50'}>
                  <TableCell>{formatBusinessDate(entry.date)}</TableCell>
                  <TableCell>{entry.item_name ?? '-'}</TableCell>
                  <TableCell>{MOVEMENT_LABEL[entry.movement_type] ?? entry.movement_type}</TableCell>
                  <TableCell className={entry.qty < 0 ? 'text-red-600' : 'text-[#3EA768]'}>
                    {entry.qty > 0 ? '+' : ''}
                    {formatQty(entry.qty)}
                  </TableCell>
                  {!hideCost && (
                    <TableCell>{entry.price != null ? formatRupiah(entry.price) : '-'}</TableCell>
                  )}
                  <TableCell>{entry.purchase_order_freetext ?? '-'}</TableCell>
                  <TableCell>{entry.created_by ?? '-'}</TableCell>
                  <TableCell className="max-w-xs whitespace-normal break-words">{entry.note ?? '-'}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon-sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingEntry(entry)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => setDeletingEntry(entry)}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />

      <RawMaterialMovementDialog open={deductDialogOpen} onOpenChange={setDeductDialogOpen} />
      <EditRawMaterialMovementDialog
        open={!!editingEntry}
        onOpenChange={(open) => !open && setEditingEntry(null)}
        entry={editingEntry}
      />

      <AlertDialog open={!!deletingEntry} onOpenChange={(open) => !open && setDeletingEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete raw material movement?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this entry from the raw material ledger and recompute current stock.
              It stays on record for audit (who deleted it is saved), but won't show here again.
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
    </div>
  )
}
