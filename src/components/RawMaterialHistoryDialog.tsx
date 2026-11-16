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
import { getRawMaterialHistory } from '@/lib/rawMaterial'

export function RawMaterialHistoryDialog({
  open,
  onOpenChange,
  rawMatId,
  rawMatName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rawMatId: number | null
  rawMatName: string | null
}) {
  const { data: history = [], isLoading, refetch } = useQuery({
    queryKey: ['raw-material-history', rawMatId],
    queryFn: () => getRawMaterialHistory(rawMatId!),
    enabled: open && rawMatId != null,
  })

  // The global query cache's staleTime would otherwise show a cached
  // snapshot on reopen -- history must always reflect the latest edits.
  useEffect(() => {
    if (open && rawMatId != null) refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rawMatId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit history — {rawMatName}</DialogTitle>
        </DialogHeader>
        <div className="h-[27.5rem] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-panel">
              <TableRow>
                <TableHead>Edited At</TableHead>
                <TableHead>Edited By</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No history found.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((entry) => (
                  <TableRow key={entry.row_increment}>
                    <TableCell>{entry.updated_at}</TableCell>
                    <TableCell>{entry.updated_by ?? '-'}</TableCell>
                    <TableCell>{entry.raw_mat_sku_name}</TableCell>
                    <TableCell>{entry.unit}</TableCell>
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
