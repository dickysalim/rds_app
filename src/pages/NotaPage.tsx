import { ChevronDown, ChevronLeft, ChevronRight, Download, MoreHorizontal } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MakePaymentDialog } from '@/components/MakePaymentDialog'
import { NotaCreatePanel } from '@/components/NotaCreatePanel'
import { NotaDetailPanel } from '@/components/NotaDetailPanel'
import { getBusiness } from '@/lib/business'
import { formatRupiah } from '@/lib/currency'
import {
  getNota,
  getPaymentEvidenceUrl,
  listNota,
  listPayments,
  statusPillClass,
  voidNota,
  type NotaListItem,
  type Payment,
} from '@/lib/nota'
import { downloadNotaPdf } from '@/lib/notaPdf'
import { previewPaymentPdfUrl } from '@/lib/paymentPdf'

const PAGE_SIZE = 25

export function NotaPage() {
  const [nota, setNota] = useState<NotaListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'create'>('list')
  const [selectedNotaId, setSelectedNotaId] = useState<number | null>(null)
  const [expandedNotaId, setExpandedNotaId] = useState<number | null>(null)
  const [paymentsByNota, setPaymentsByNota] = useState<Record<number, Payment[]>>({})
  const [paymentDialogNotaId, setPaymentDialogNotaId] = useState<number | null>(null)
  const [deleteNotaId, setDeleteNotaId] = useState<number | null>(null)
  const [paymentPdfUrl, setPaymentPdfUrl] = useState<string | null>(null)
  const [paymentPdfLoading, setPaymentPdfLoading] = useState(false)
  const [paymentPdfError, setPaymentPdfError] = useState<string | null>(null)
  const paymentPdfBlobRef = useRef<string | null>(null)

  function refetch(targetPage: number) {
    setLoading(true)
    listNota({ limit: PAGE_SIZE, offset: (targetPage - 1) * PAGE_SIZE })
      .then(({ nota: rows, total: rowTotal }) => {
        setNota(rows)
        setTotal(rowTotal)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refetch(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function handleSaved(created: NotaListItem) {
    setView('list')
    setSelectedNotaId(created.nota_id)
    setPage(1)
    refetch(1)
  }

  function toggleExpand(notaId: number) {
    const next = expandedNotaId === notaId ? null : notaId
    setExpandedNotaId(next)
    if (next !== null && !paymentsByNota[next]) {
      listPayments(next)
        .then((payments) => setPaymentsByNota((prev) => ({ ...prev, [next]: payments })))
        .catch(() => {})
    }
  }

  function handlePaymentCreated(notaId: number) {
    listPayments(notaId)
      .then((payments) => setPaymentsByNota((prev) => ({ ...prev, [notaId]: payments })))
      .catch(() => {})
    refetch(page)
  }

  async function handleDownloadPdf(notaId: number) {
    try {
      const [nota, business] = await Promise.all([getNota(notaId), getBusiness()])
      if (!business) throw new Error('Set up Business Settings first')
      await downloadNotaPdf(nota, business)
    } catch {
      // ignore; user can retry from the menu
    }
  }

  function closePaymentPdf() {
    if (paymentPdfBlobRef.current) {
      URL.revokeObjectURL(paymentPdfBlobRef.current)
      paymentPdfBlobRef.current = null
    }
    setPaymentPdfUrl(null)
    setPaymentPdfError(null)
  }

  async function handleSeePaymentPdf(notaId: number, payment: Payment) {
    setPaymentPdfLoading(true)
    setPaymentPdfError(null)
    setPaymentPdfUrl(null)
    try {
      const [notaDetail, business] = await Promise.all([getNota(notaId), getBusiness()])
      if (!business) throw new Error('Set up Business Settings first')
      const url = await previewPaymentPdfUrl(notaDetail, payment, business)
      if (paymentPdfBlobRef.current) URL.revokeObjectURL(paymentPdfBlobRef.current)
      paymentPdfBlobRef.current = url
      setPaymentPdfUrl(url)
    } catch (err) {
      setPaymentPdfError(err instanceof Error ? err.message : 'Failed to generate PDF')
    } finally {
      setPaymentPdfLoading(false)
    }
  }

  async function handleConfirmDelete() {
    if (deleteNotaId === null) return
    const notaId = deleteNotaId
    setDeleteNotaId(null)
    try {
      await voidNota(notaId)
      refetch(page)
    } catch {
      // ignore; nota stays in list
    }
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
      <Table className="text-xs [&_th]:h-8 [&_td]:py-1.5">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Nota Number</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="text-right">Total Bill</TableHead>
            <TableHead className="text-right">Unpaid</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          ) : nota.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground">
                No nota yet.
              </TableCell>
            </TableRow>
          ) : (
            nota.map((n) => {
              const isExpanded = expandedNotaId === n.nota_id
              const payments = paymentsByNota[n.nota_id]
              return (
                <Fragment key={n.nota_id}>
                  <TableRow
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => setSelectedNotaId(n.nota_id)}
                  >
                    <TableCell>
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExpand(n.nota_id)
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>{n.nota_number}</TableCell>
                    <TableCell>{n.nota_date}</TableCell>
                    <TableCell>{n.customer_company_name_snapshot}</TableCell>
                    <TableCell>{n.contact_name_snapshot}</TableCell>
                    <TableCell className="text-right">{formatRupiah(n.total_price)}</TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(n.total_price - n.paid_amount)}
                    </TableCell>
                    <TableCell className="text-right">{formatRupiah(n.paid_amount)}</TableCell>
                    <TableCell>
                      <span className={`capitalize ${statusPillClass(n.status)}`}>{n.status}</span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
                          >
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPaymentDialogNotaId(n.nota_id)}>
                            Make Payment
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadPdf(n.nota_id)}>
                            Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteNotaId(n.nota_id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={10} className="bg-muted/30 pl-14">
                        {!payments ? (
                          <p className="py-2 text-sm text-muted-foreground">Loading payments…</p>
                        ) : payments.length === 0 ? (
                          <p className="py-2 text-sm text-muted-foreground">No payments yet.</p>
                        ) : (
                          <Table className="w-auto text-xs [&_th]:h-8 [&_th]:px-1.5 [&_td]:px-1.5 [&_td]:py-1.5">
                            <colgroup>
                              <col className="w-32" />
                              <col className="w-24" />
                              <col className="w-32" />
                              <col className="w-28" />
                              <col className="w-24" />
                              <col />
                              <col className="w-8" />
                            </colgroup>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Payment Number</TableHead>
                                <TableHead>Payment Date</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead>Evidence</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead className="w-8" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {payments.map((p) => (
                                <TableRow key={p.payment_id}>
                                  <TableCell className="truncate">
                                    {p.payment_number ?? '-'}
                                  </TableCell>
                                  <TableCell className="truncate">{p.payment_date}</TableCell>
                                  <TableCell className="text-right">
                                    {formatRupiah(p.amount)}
                                  </TableCell>
                                  <TableCell className="truncate">{p.method ?? '-'}</TableCell>
                                  <TableCell>
                                    {p.evidence_key ? (
                                      <a
                                        href={getPaymentEvidenceUrl(n.nota_id, p.payment_id)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-primary underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        View
                                      </a>
                                    ) : (
                                      '-'
                                    )}
                                  </TableCell>
                                  <TableCell className="whitespace-normal break-words">
                                    {p.reference ?? '-'}
                                  </TableCell>
                                  <TableCell onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2"
                                      onClick={() => handleSeePaymentPdf(n.nota_id, p)}
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                      Download PDF
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {total === 0
            ? 'No nota yet.'
            : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>
            Page {page} of {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={page >= pageCount || loading}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {paymentDialogNotaId !== null && (
        <MakePaymentDialog
          notaId={paymentDialogNotaId}
          open
          onClose={() => setPaymentDialogNotaId(null)}
          onCreated={() => handlePaymentCreated(paymentDialogNotaId)}
        />
      )}

      <AlertDialog open={deleteNotaId !== null} onOpenChange={(open) => !open && setDeleteNotaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this nota?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be hidden from the list but kept in records. This can&apos;t be undone from
              here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={paymentPdfLoading || paymentPdfUrl !== null || paymentPdfError !== null}
        onOpenChange={(open) => !open && closePaymentPdf()}
      >
        <DialogContent className="max-w-3xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bukti Pembayaran</DialogTitle>
          </DialogHeader>
          {paymentPdfLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Generating…</p>
          ) : paymentPdfError ? (
            <p className="py-8 text-center text-sm text-destructive">{paymentPdfError}</p>
          ) : paymentPdfUrl ? (
            <iframe
              title="Payment PDF"
              src={paymentPdfUrl}
              className="h-[60vh] w-full rounded-md border"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
