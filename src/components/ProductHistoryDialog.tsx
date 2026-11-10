import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatRupiah } from '@/lib/currency'
import { getProductHistory } from '@/lib/products'

export function ProductHistoryDialog({
  open,
  onOpenChange,
  skuId,
  skuName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  skuId: number | null
  skuName: string | null
}) {
  const { data: history = [], isLoading, refetch } = useQuery({
    queryKey: ['product-history', skuId],
    queryFn: () => getProductHistory(skuId!),
    enabled: open && skuId != null,
  })

  // The global query cache's staleTime would otherwise show a cached
  // snapshot on reopen -- history must always reflect the latest edits.
  useEffect(() => {
    if (open && skuId != null) refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, skuId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit history — {skuName}</DialogTitle>
        </DialogHeader>
        <div className="h-[27.5rem] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-panel">
              <TableRow>
                <TableHead>Edited At</TableHead>
                <TableHead>Edited By</TableHead>
                <TableHead>SKU Name</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Suggested Price</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Profit</TableHead>
                <TableHead>Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No history found.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((entry) => (
                  <TableRow key={entry.row_increment}>
                    <TableCell>{entry.updated_at}</TableCell>
                    <TableCell>{entry.updated_by ?? '-'}</TableCell>
                    <TableCell>{entry.sku_name}</TableCell>
                    <TableCell>{entry.unit}</TableCell>
                    <TableCell>
                      {entry.suggested_price != null ? formatRupiah(entry.suggested_price) : '-'}
                    </TableCell>
                    <TableCell>
                      {entry.cost_price != null ? formatRupiah(entry.cost_price) : '-'}
                    </TableCell>
                    <TableCell>
                      {entry.suggested_price != null && entry.cost_price != null
                        ? formatRupiah(entry.suggested_price - entry.cost_price)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {entry.suggested_price
                        ? `${Math.round(((entry.suggested_price - (entry.cost_price ?? 0)) / entry.suggested_price) * 100)}%`
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
