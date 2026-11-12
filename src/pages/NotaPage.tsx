import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Download, MoreHorizontal } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PdfPreviewFrame } from '@/components/PdfPreviewFrame'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AppOutletContext } from '@/components/AppLayout'
import { CompanyOverviewView } from '@/components/CompanyOverviewView'
import { MakePaymentDialog } from '@/components/MakePaymentDialog'
import { NotaCreatePanel } from '@/components/NotaCreatePanel'
import { NotaDetailPanel } from '@/components/NotaDetailPanel'
import { hideFinancials } from '@/lib/access'
import { formatRupiah } from '@/lib/currency'
import {
  billPeriodOf,
  getNota,
  getPaymentEvidenceUrl,
  listBillPayments,
  pajakCostOf,
  statusLabel,
  statusPillClass,
  totalBillOf,
  type NotaListItem,
  type Payment,
} from '@/lib/nota'
import { downloadNotaPdf } from '@/lib/notaPdf'
import { previewPaymentPdfUrl } from '@/lib/paymentPdf'
import { queryKeys, useBusinessQuery, useNotaListQuery, useVoidNotaMutation } from '@/lib/queries'

const PAGE_SIZE = 25

export function NotaPage() {
  const { user } = useOutletContext<AppOutletContext>()
  const hideCost = hideFinancials(user.role)
  const queryClient = useQueryClient()
  const { data: business } = useBusinessQuery()
  const voidMutation = useVoidNotaMutation()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [view, setView] = useState<'list' | 'create'>('list')
  const [companyDetailOpen, setCompanyDetailOpen] = useState(false)
  const [selectedNotaId, setSelectedNotaId] = useState<number | null>(null)
  const [expandedNotaId, setExpandedNotaId] = useState<number | null>(null)
  const [paymentsByNota, setPaymentsByNota] = useState<Record<number, Payment[]>>({})
  const [paymentDialogTarget, setPaymentDialogTarget] = useState<NotaListItem | null>(null)
  const [paymentDialogDefaultAmount, setPaymentDialogDefaultAmount] = useState(0)
  const [deleteNotaId, setDeleteNotaId] = useState<number | null>(null)
  const [paymentPdfUrl, setPaymentPdfUrl] = useState<string | null>(null)
  const [paymentPdfLoading, setPaymentPdfLoading] = useState(false)
  const [paymentPdfError, setPaymentPdfError] = useState<string | null>(null)
  const paymentPdfBlobRef = useRef<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status, startDate, endDate])

  const { data: notaPage, isLoading: loading } = useNotaListQuery({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    q: debouncedSearch || undefined,
    status: status !== 'all' ? status : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  })
  const nota = notaPage?.nota ?? []
  const total = notaPage?.total ?? 0

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function handleSaved(created: { nota_id: number }) {
    setView('list')
    setSelectedNotaId(created.nota_id)
    setPage(1)
  }

  function toggleExpandNota(n: NotaListItem) {
    const next = expandedNotaId === n.nota_id ? null : n.nota_id
    setExpandedNotaId(next)
    if (next !== null && !paymentsByNota[next]) {
      const { year, month } = billPeriodOf(n)
      queryClient
        .fetchQuery({
          queryKey: queryKeys.payments(n.customer_id, year, month),
          queryFn: () => listBillPayments(n.customer_id, year, month),
        })
        .then((payments) => setPaymentsByNota((prev) => ({ ...prev, [next]: payments })))
        .catch(() => {})
    }
  }

  function handlePaymentCreated(n: NotaListItem) {
    queryClient.invalidateQueries({ queryKey: ['nota'] })
    const { year, month } = billPeriodOf(n)
    const queryKey = queryKeys.payments(n.customer_id, year, month)
    queryClient.invalidateQueries({ queryKey })
    queryClient
      .fetchQuery({
        queryKey,
        queryFn: () => listBillPayments(n.customer_id, year, month),
      })
      .then((payments) => setPaymentsByNota((prev) => ({ ...prev, [n.nota_id]: payments })))
      .catch(() => {})
  }

  async function handleDownloadPdf(notaId: number) {
    try {
      const notaDetail = await queryClient.fetchQuery({
        queryKey: queryKeys.notaDetail(notaId),
        queryFn: () => getNota(notaId),
      })
      if (!business) throw new Error('Set up Business Settings first')
      await downloadNotaPdf(notaDetail, business)
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

  async function handleSeePaymentPdf(n: NotaListItem, payment: Payment) {
    setPaymentPdfLoading(true)
    setPaymentPdfError(null)
    setPaymentPdfUrl(null)
    try {
      if (!business) throw new Error('Set up Business Settings first')
      const url = await previewPaymentPdfUrl(n, payment, business)
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
      await voidMutation.mutateAsync(notaId)
    } catch {
      // ignore; nota stays in list
    }
  }

  if (view === 'create') {
    return <NotaCreatePanel onCancel={() => setView('list')} onSaved={handleSaved} />
  }

  return (
    <div className="space-y-4">
      {selectedNotaId !== null && (
        <NotaDetailPanel notaId={selectedNotaId} onBack={() => setSelectedNotaId(null)} />
      )}
      <h1 className="text-2xl font-semibold tracking-tight">Nota</h1>

      <Tabs defaultValue="overview">
        {!companyDetailOpen && (
          <TabsList>
            <TabsTrigger value="overview">Monthly Overview</TabsTrigger>
            <TabsTrigger value="nota">Nota View</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="overview">
          <CompanyOverviewView
            onAddNota={() => setView('create')}
            onSelectNota={setSelectedNotaId}
            onDetailOpenChange={setCompanyDetailOpen}
          />
        </TabsContent>

        <TabsContent value="nota" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search nota…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-80"
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partial">Partially Paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            max={endDate || undefined}
            className="w-36"
            aria-label="Start date"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate || undefined}
            className="w-36"
            aria-label="End date"
          />
          {(search || status !== 'all' || startDate || endDate) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setStatus('all')
                setStartDate('')
                setEndDate('')
              }}
            >
              Clear
            </Button>
          )}
        </div>
        <Button onClick={() => setView('create')}>+ Add Nota</Button>
      </div>

      <div className="overflow-x-auto rounded-md border bg-panel shadow-sm border-[oklch(0.84_0_0)] [&_tr]:border-[oklch(0.86_0_0)]">
<Table className="text-xs [&_th]:h-8 [&_td]:py-1.5">
        <TableHeader>
          <TableRow>
            <TableHead>Nota Number</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="text-right">Total Bill</TableHead>
            {!hideCost && <TableHead className="text-right">Cost</TableHead>}
            {!hideCost && <TableHead className="text-right">Profit</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={hideCost ? 8 : 10} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          ) : nota.length === 0 ? (
            <TableRow>
              <TableCell colSpan={hideCost ? 8 : 10} className="text-center text-muted-foreground">
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
                    <TableCell>{n.nota_number}</TableCell>
                    <TableCell>{n.nota_date}</TableCell>
                    <TableCell>{n.customer_company_name_snapshot}</TableCell>
                    <TableCell>{n.contact_name_snapshot ?? '-'}</TableCell>
                    <TableCell className="text-right">{formatRupiah(totalBillOf(n))}</TableCell>
                    {!hideCost && (
                      <TableCell className="text-right leading-tight">
                        <div className="ml-4 inline-grid grid-cols-[auto_auto_auto] gap-x-1">
                          <span>Cost</span>
                          <span className="text-center">:</span>
                          <span>{formatRupiah(n.total_cost)}</span>
                          <span>Tax</span>
                          <span className="text-center">:</span>
                          <span>{formatRupiah(pajakCostOf(n))}</span>
                        </div>
                      </TableCell>
                    )}
                    {!hideCost && (
                      <TableCell className="text-right">
                        {formatRupiah(n.total_price - n.total_cost)}
                      </TableCell>
                    )}
                    <TableCell>
                      <span className={statusPillClass(n.status)}>{statusLabel(n.status)}</span>
                    </TableCell>
                    <TableCell>{n.created_by ?? '-'}</TableCell>
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
                          <DropdownMenuItem
                            onClick={() => {
                              setPaymentDialogTarget(n)
                              setPaymentDialogDefaultAmount(n.total_price - n.paid_amount)
                            }}
                          >
                            Add Payment
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleExpandNota(n)}>
                            See Payment
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
                      <TableCell colSpan={hideCost ? 8 : 10} className="bg-panel pl-14">
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
                                        href={getPaymentEvidenceUrl(p.payment_id)}
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
                                      onClick={() => handleSeePaymentPdf(n, p)}
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
</div>

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
        </TabsContent>
      </Tabs>

      {paymentDialogTarget !== null && (
        <MakePaymentDialog
          customerId={paymentDialogTarget.customer_id}
          year={billPeriodOf(paymentDialogTarget).year}
          month={billPeriodOf(paymentDialogTarget).month}
          defaultAmount={paymentDialogDefaultAmount}
          open
          onClose={() => setPaymentDialogTarget(null)}
          onCreated={() => handlePaymentCreated(paymentDialogTarget)}
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
        <DialogContent className="flex h-[90vh] max-h-[90vh] max-w-3xl flex-col sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bukti Pembayaran</DialogTitle>
          </DialogHeader>
          {paymentPdfLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Generating…</p>
          ) : paymentPdfError ? (
            <p className="py-8 text-center text-sm text-destructive">{paymentPdfError}</p>
          ) : paymentPdfUrl ? (
            <PdfPreviewFrame
              title="Payment PDF"
              url={paymentPdfUrl}
              frameClassName="w-full rounded-md border"
            />
          ) : null}
        </DialogContent>
      </Dialog>

    </div>
  )
}
