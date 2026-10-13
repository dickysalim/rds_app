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
import { NotaCreatePanel } from '@/components/NotaCreatePanel'
import { NotaDetailPanel } from '@/components/NotaDetailPanel'
import { formatRupiah } from '@/lib/currency'
import { listNota, type NotaListItem } from '@/lib/nota'

export function NotaPage() {
  const [nota, setNota] = useState<NotaListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'create'>('list')
  const [selectedNotaId, setSelectedNotaId] = useState<number | null>(null)

  useEffect(() => {
    listNota()
      .then(setNota)
      .finally(() => setLoading(false))
  }, [])

  function handleSaved(created: NotaListItem) {
    setNota((prev) => [created, ...prev])
    setView('list')
  }

  if (view === 'create') {
    return <NotaCreatePanel onCancel={() => setView('list')} onSaved={handleSaved} />
  }

  if (selectedNotaId !== null) {
    return <NotaDetailPanel notaId={selectedNotaId} onBack={() => setSelectedNotaId(null)} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Nota</h1>
        <Button onClick={() => setView('create')}>+ Add Nota</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nota Number</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          ) : nota.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No nota yet.
              </TableCell>
            </TableRow>
          ) : (
            nota.map((n) => (
              <TableRow
                key={n.nota_id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => setSelectedNotaId(n.nota_id)}
              >
                <TableCell>{n.nota_number}</TableCell>
                <TableCell>{n.nota_date}</TableCell>
                <TableCell>{n.customer_company_name_snapshot}</TableCell>
                <TableCell>{n.contact_name_snapshot}</TableCell>
                <TableCell className="text-right">{formatRupiah(n.total_price)}</TableCell>
                <TableCell className="capitalize">{n.status}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
