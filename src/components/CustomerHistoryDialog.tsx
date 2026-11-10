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
import { getCustomerHistory } from '@/lib/customers'

export function CustomerHistoryDialog({
  open,
  onOpenChange,
  customerId,
  companyName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: number | null
  companyName: string | null
}) {
  const { data: history = [], isLoading, refetch } = useQuery({
    queryKey: ['customer-history', customerId],
    queryFn: () => getCustomerHistory(customerId!),
    enabled: open && customerId != null,
  })

  // The global query cache's staleTime would otherwise show a cached
  // snapshot on reopen -- history must always reflect the latest edits.
  useEffect(() => {
    if (open && customerId != null) refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit history — {companyName}</DialogTitle>
        </DialogHeader>
        <div className="h-[27.5rem] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-panel">
              <TableRow>
                <TableHead>Edited At</TableHead>
                <TableHead>Edited By</TableHead>
                <TableHead>Company Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No history found.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((entry) => (
                  <TableRow key={entry.row_increment}>
                    <TableCell>{entry.updated_at}</TableCell>
                    <TableCell>{entry.updated_by ?? '-'}</TableCell>
                    <TableCell>{entry.company_name}</TableCell>
                    <TableCell>{entry.address ?? '-'}</TableCell>
                    <TableCell>{entry.contact_person ?? '-'}</TableCell>
                    <TableCell>{entry.phone_number ?? '-'}</TableCell>
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
