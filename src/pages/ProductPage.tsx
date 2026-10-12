import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function ProductPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Product</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU Name</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="text-right">Suggested Price</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              No products yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
