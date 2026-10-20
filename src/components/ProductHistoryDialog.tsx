import { useQuery } from '@tanstack/react-query'
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
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['product-history', skuId],
    queryFn: () => getProductHistory(skuId!),
    enabled: open && skuId != null,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit history — {skuName}</DialogTitle>
        </DialogHeader>
        <div className="h-[27.5rem] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-white">
              <TableRow>
                <TableHead>Edited At</TableHead>
                <TableHead>Edited By</TableHead>
                <TableHead>SKU Name</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Suggested Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
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
