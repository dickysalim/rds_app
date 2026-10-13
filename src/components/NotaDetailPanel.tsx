import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatRupiah } from '@/lib/currency'
import { getNota, type NotaDetail } from '@/lib/nota'

export function NotaDetailPanel({ notaId, onBack }: { notaId: number; onBack: () => void }) {
  const [nota, setNota] = useState<NotaDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNota(notaId)
      .then(setNota)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [notaId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {nota ? nota.nota_number : 'Nota Detail'}
        </h1>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : nota ? (
        <>
          <div className="grid max-w-3xl grid-cols-[9rem_1fr_9rem_1fr] gap-x-8 gap-y-2 text-sm">
            <div className="text-right font-medium text-muted-foreground">Date</div>
            <div>{nota.nota_date}</div>
            <div className="text-right font-medium text-muted-foreground">Status</div>
            <div className="capitalize">{nota.status}</div>

            <div className="text-right font-medium text-muted-foreground">Company Name</div>
            <div>{nota.customer_company_name_snapshot}</div>
            <div className="text-right font-medium text-muted-foreground">Contact Person</div>
            <div>{nota.contact_name_snapshot}</div>

            <div className="text-right font-medium text-muted-foreground">Company Address</div>
            <div>{nota.customer_address_snapshot ?? '-'}</div>
            <div className="text-right font-medium text-muted-foreground">Phone Number</div>
            <div>{nota.contact_phone_number_snapshot}</div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Disc. Amount</TableHead>
                <TableHead className="text-right">Disc. %</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nota.items.map((item) => (
                <TableRow key={item.nota_item_id}>
                  <TableCell>{item.item_name_snapshot}</TableCell>
                  <TableCell>{item.unit_snapshot}</TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right">{formatRupiah(item.price)}</TableCell>
                  <TableCell className="text-right">{formatRupiah(item.discount_amount)}</TableCell>
                  <TableCell className="text-right">{item.discount_percent}%</TableCell>
                  <TableCell className="text-right">{formatRupiah(item.total_price)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end gap-8 pr-2 text-sm">
            <div className="text-right">
              <div className="text-muted-foreground">Total</div>
              <div className="font-semibold">{formatRupiah(nota.total_price)}</div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground">Paid</div>
              <div className="font-semibold">{formatRupiah(nota.paid_amount)}</div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
