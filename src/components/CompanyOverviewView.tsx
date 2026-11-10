import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
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
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PdfPreviewFrame } from '@/components/PdfPreviewFrame'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MakePaymentDialog } from '@/components/MakePaymentDialog'
import { previewBillPdfUrl } from '@/lib/billPdf'
import { formatRupiah } from '@/lib/currency'
import { getNota, getPaymentEvidenceUrl, listBillPayments, pajakCostOf, statusLabel, statusPillClass, sumTotals, totalBillOf, voidPayment, type NotaListItem, type Payment, type Totals } from '@/lib/nota'
import { downloadNotaPdf } from '@/lib/notaPdf'
import { downloadPaymentPdf, previewPaymentPdfUrl } from '@/lib/paymentPdf'
import {
  queryKeys,
  useBusinessQuery,
  useCustomersQuery,
  useNotaDateRangeQuery,
  useNotaListQuery,
  useVoidNotaMutation,
} from '@/lib/queries'

interface CompanyGroup extends Totals {
  company: string
  nota: NotaListItem[]
}

function companyStatus(c: Totals): 'paid' | 'unpaid' | 'partial' {
  if (c.totalUnpaid <= 0) return 'paid'
  if (c.totalPaid <= 0) return 'unpaid'
  return 'partial'
}

const STATUS_ORDER = { unpaid: 0, partial: 1, paid: 2 }

function groupByCompany(nota: NotaListItem[]): CompanyGroup[] {
  const companies = new Map<string, NotaListItem[]>()
  for (const n of nota) {
    const list = companies.get(n.customer_company_name_snapshot) ?? []
    list.push(n)
    companies.set(n.customer_company_name_snapshot, list)
  }

  return Array.from(companies.entries())
    .map(([company, list]) => ({
      company,
      nota: [...list].sort((a, b) => (a.nota_date < b.nota_date ? 1 : -1)),
      ...sumTotals(list),
    }))
    .sort(
      (a, b) =>
        STATUS_ORDER[companyStatus(a)] - STATUS_ORDER[companyStatus(b)] ||
        b.totalBill - a.totalBill ||
        a.company.localeCompare(b.company),
    )
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

export function CompanyOverviewView({
  onAddNota,
  onSelectNota,
  onDetailOpenChange,
}: {
  onAddNota: () => void
  onSelectNota: (notaId: number) => void
  onDetailOpenChange?: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { data: business } = useBusinessQuery()
  const { data: customers = [] } = useCustomersQuery()
  const voidMutation = useVoidNotaMutation()
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [openCompany, setOpenCompany] = useState<string | null>(null)
  const [paymentsByCompany, setPaymentsByCompany] = useState<Record<string, Payment[]>>({})
  const [deleteNotaId, setDeleteNotaId] = useState<number | null>(null)
  const [deletePayment, setDeletePayment] = useState<{ company: string; payment: Payment } | null>(null)
  const [paymentPdfUrl, setPaymentPdfUrl] = useState<string | null>(null)
  const [paymentPdfLoading, setPaymentPdfLoading] = useState(false)
  const [paymentPdfError, setPaymentPdfError] = useState<string | null>(null)
  const paymentPdfBlobRef = useRef<string | null>(null)
  const [comingSoon, setComingSoon] = useState<string | null>(null)
  const [paymentDialogCompany, setPaymentDialogCompany] = useState<string | null>(null)
  const [paymentDialogCustomerId, setPaymentDialogCustomerId] = useState(0)
  const [paymentDialogDefaultAmount, setPaymentDialogDefaultAmount] = useState(0)
  const [billPdfUrl, setBillPdfUrl] = useState<string | null>(null)
  const [billPdfLoading, setBillPdfLoading] = useState(false)
  const [billPdfError, setBillPdfError] = useState<string | null>(null)
  const billPdfBlobRef = useRef<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const monthStart = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
  const monthEnd = new Date(selectedYear, selectedMonth, 0).toISOString().slice(0, 10)

  const { data: notaPage, isLoading: loading } = useNotaListQuery({
    q: debouncedSearch || undefined,
    startDate: monthStart,
    endDate: monthEnd,
  })
  const nota = notaPage?.nota ?? []

  const { data: dateRange } = useNotaDateRangeQuery()
  const fellBackRef = useRef(false)
  useEffect(() => {
    if (fellBackRef.current || loading || !dateRange) return
    fellBackRef.current = true
    if (nota.length > 0) return
    if (dateRange.maxYear == null || dateRange.maxMonth == null) return
    if (
      dateRange.maxYear > selectedYear ||
      (dateRange.maxYear === selectedYear && dateRange.maxMonth > selectedMonth)
    ) {
      return
    }
    setSelectedYear(dateRange.maxYear)
    setSelectedMonth(dateRange.maxMonth)
  }, [dateRange, loading, nota.length, selectedYear, selectedMonth])

  const allCompanies = useMemo(() => groupByCompany(nota), [nota])
  const companies = allCompanies.filter((c) => {
    if (status === 'all') return true
    return companyStatus(c) === status
  })
  const modalCompany = allCompanies.find((c) => c.company === openCompany) ?? null
  const modalPayments = modalCompany ? paymentsByCompany[modalCompany.company] : undefined

  useEffect(() => {
    onDetailOpenChange?.(modalCompany !== null)
  }, [modalCompany, onDetailOpenChange])
  const monthLabel = MONTH_FORMATTER.format(new Date(selectedYear, selectedMonth - 1, 1))

  const totals = useMemo(() => sumTotals(nota), [nota])
  const totalCost = useMemo(() => nota.reduce((sum, n) => sum + n.total_cost, 0), [nota])
  const totalProfit = totals.totalBill - totalCost
  const settledCompanyCount = allCompanies.filter((c) => c.totalPaid === c.totalBill).length
  const unsettledCompanyCount = allCompanies.length - settledCompanyCount

  function shiftMonth(delta: number) {
    setOpenCompany(null)
    let m = selectedMonth + delta
    let y = selectedYear
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    setSelectedMonth(m)
    setSelectedYear(y)
  }

  function fetchCompanyPayments(company: CompanyGroup, opts?: { fresh?: boolean }) {
    const key = company.company
    const customerId = company.nota[0].customer_id
    const queryKey = queryKeys.payments(customerId, selectedYear, selectedMonth)
    if (opts?.fresh) queryClient.invalidateQueries({ queryKey })
    queryClient
      .fetchQuery({
        queryKey,
        queryFn: () => listBillPayments(customerId, selectedYear, selectedMonth),
      })
      .then((payments) => setPaymentsByCompany((prev) => ({ ...prev, [key]: payments })))
      .catch(() => {})
  }

  function toggleCompany(company: CompanyGroup) {
    const key = company.company
    setOpenCompany(key)
    if (!paymentsByCompany[key]) {
      fetchCompanyPayments(company)
    }
  }

  function handlePaymentCreated(companyName: string) {
    queryClient.invalidateQueries({ queryKey: ['nota'] })
    const company = companies.find((c) => c.company === companyName)
    if (!company) return
    setPaymentsByCompany((prev) => {
      const next = { ...prev }
      delete next[companyName]
      return next
    })
    if (openCompany === companyName) fetchCompanyPayments(company, { fresh: true })
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
      // ignore; user can retry from the row
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

  function closePaymentPdf() {
    if (paymentPdfBlobRef.current) {
      URL.revokeObjectURL(paymentPdfBlobRef.current)
      paymentPdfBlobRef.current = null
    }
    setPaymentPdfUrl(null)
    setPaymentPdfError(null)
  }

  async function handleSeePaymentPdf(company: CompanyGroup, payment: Payment) {
    setPaymentPdfLoading(true)
    setPaymentPdfError(null)
    setPaymentPdfUrl(null)
    try {
      if (!business) throw new Error('Set up Business Settings first')
      const url = await previewPaymentPdfUrl(company.nota[0], payment, business)
      if (paymentPdfBlobRef.current) URL.revokeObjectURL(paymentPdfBlobRef.current)
      paymentPdfBlobRef.current = url
      setPaymentPdfUrl(url)
    } catch (err) {
      setPaymentPdfError(err instanceof Error ? err.message : 'Failed to generate PDF')
    } finally {
      setPaymentPdfLoading(false)
    }
  }

  async function handleDownloadPaymentPdf(company: CompanyGroup, payment: Payment) {
    try {
      if (!business) throw new Error('Set up Business Settings first')
      await downloadPaymentPdf(company.nota[0], payment, business)
    } catch {
      // ignore; user can retry from the row
    }
  }

  async function handleConfirmDeletePayment() {
    if (!deletePayment) return
    const { company, payment } = deletePayment
    setDeletePayment(null)
    try {
      await voidPayment(payment.payment_id)
      queryClient.invalidateQueries({ queryKey: ['nota'] })
      setPaymentsByCompany((prev) => ({
        ...prev,
        [company]: (prev[company] ?? []).filter((p) => p.payment_id !== payment.payment_id),
      }))
    } catch {
      // ignore; payment stays in list
    }
  }

  function closeBillPdf() {
    if (billPdfBlobRef.current) {
      URL.revokeObjectURL(billPdfBlobRef.current)
      billPdfBlobRef.current = null
    }
    setBillPdfUrl(null)
    setBillPdfError(null)
  }

  async function handlePrintBill(company: CompanyGroup) {
    const customer = customers.find((c) => c.company_name === company.company)
    if (!customer) {
      setBillPdfError('Customer record not found for this company')
      setBillPdfLoading(false)
      setBillPdfUrl(null)
      return
    }
    setBillPdfLoading(true)
    setBillPdfError(null)
    setBillPdfUrl(null)
    try {
      if (!business) throw new Error('Set up Business Settings first')
      const url = await previewBillPdfUrl(company.nota, customer, business, selectedYear, selectedMonth)
      if (billPdfBlobRef.current) URL.revokeObjectURL(billPdfBlobRef.current)
      billPdfBlobRef.current = url
      setBillPdfUrl(url)
    } catch (err) {
      setBillPdfError(err instanceof Error ? err.message : 'Failed to generate PDF')
    } finally {
      setBillPdfLoading(false)
    }
  }

  const sharedDialogs = (
    <>

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

      <AlertDialog open={deletePayment !== null} onOpenChange={(open) => !open && setDeletePayment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be hidden from the bill but kept in records. This can&apos;t be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeletePayment}>Delete</AlertDialogAction>
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
      <Dialog
        open={billPdfLoading || billPdfUrl !== null || billPdfError !== null}
        onOpenChange={(open) => !open && closeBillPdf()}
      >
        <DialogContent className="flex h-[90vh] max-h-[90vh] max-w-5xl flex-col sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Tagihan</DialogTitle>
          </DialogHeader>
          {billPdfLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Generating…</p>
          ) : billPdfError ? (
            <p className="py-8 text-center text-sm text-destructive">{billPdfError}</p>
          ) : billPdfUrl ? (
            <PdfPreviewFrame title="Bill PDF" url={billPdfUrl} frameClassName="w-full rounded-md border" />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={comingSoon !== null} onOpenChange={(open) => !open && setComingSoon(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{comingSoon}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Coming soon.</p>
        </DialogContent>
      </Dialog>

      {paymentDialogCompany !== null && (
        <MakePaymentDialog
          customerId={paymentDialogCustomerId}
          year={selectedYear}
          month={selectedMonth}
          defaultAmount={paymentDialogDefaultAmount}
          open
          onClose={() => setPaymentDialogCompany(null)}
          onCreated={() => handlePaymentCreated(paymentDialogCompany)}
        />
      )}
    </>
  )

  if (modalCompany) {
    const company = modalCompany
    const settled = company.totalUnpaid <= 0
    const totalCost = company.nota.reduce((sum, n) => sum + n.total_cost, 0)
    const totalProfit = company.totalBill - totalCost
    return (
      <div className="space-y-4 pb-[40vh]">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpenCompany(null)}
          className="w-fit rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <h1 className="text-center text-2xl font-bold">
          {company.company} - {monthLabel}
        </h1>

        <div className="grid grid-cols-5 gap-3">
          <Card size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground">Total Nota</p>
              <p className="text-[22px] leading-tight font-semibold tabular-nums">{company.notaCount}</p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground">Total Bill</p>
              <p className="text-[22px] leading-tight font-semibold tabular-nums break-all">
                {formatRupiah(company.totalBill)}
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground">Total Cost</p>
              <p className="text-[22px] leading-tight font-semibold tabular-nums break-all">
                {formatRupiah(totalCost)}
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground">Total Profit</p>
              <p className="text-[22px] leading-tight font-semibold tabular-nums break-all">
                {formatRupiah(totalProfit)}
              </p>
            </CardContent>
          </Card>
          <Card size="sm" className={settled ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <CardContent>
              <p className={`text-xs ${settled ? 'text-green-800' : 'text-red-800'}`}>Total Paid</p>
              <p
                className={`text-[22px] leading-tight font-semibold tabular-nums break-all ${settled ? 'text-green-700' : 'text-red-700'}`}
              >
                {formatRupiah(company.totalPaid)}
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="default" onClick={() => handlePrintBill(company)}>
            Print Bill
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={() => {
              setPaymentDialogCompany(company.company)
              setPaymentDialogCustomerId(company.nota[0].customer_id)
              setPaymentDialogDefaultAmount(company.totalUnpaid)
            }}
          >
            Add Payment
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-bold">Nota</h2>
          <div className="h-[50vh] overflow-y-auto rounded-md border border-[oklch(0.84_0_0)] bg-panel [&_tr]:border-[oklch(0.86_0_0)]">
            <Table className="w-full table-fixed text-xs [&_th]:h-8 [&_td]:py-1.5">
              <colgroup>
                <col className="w-[130px]" />
                <col className="w-[85px]" />
                <col className="w-[100px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col />
                <col className="w-10" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-3 font-bold">Nota Number</TableHead>
                  <TableHead className="font-bold">Date</TableHead>
                  <TableHead className="text-right font-bold">Sub Total</TableHead>
                  <TableHead className="font-bold">Pajak Name</TableHead>
                  <TableHead className="text-right font-bold">Pajak Cost</TableHead>
                  <TableHead className="text-right font-bold">Total Bill</TableHead>
                  <TableHead className="text-right font-bold">Cost</TableHead>
                  <TableHead className="text-right font-bold">Profit</TableHead>
                  <TableHead className="font-bold">Notes</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {company.nota.map((n) => (
                  <TableRow
                    key={n.nota_id}
                    className="h-9 cursor-pointer hover:bg-accent/50"
                    onClick={() => onSelectNota(n.nota_id)}
                  >
                    <TableCell className="whitespace-nowrap pl-3">{n.nota_number}</TableCell>
                    <TableCell className="whitespace-nowrap">{n.nota_date}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {formatRupiah(n.total_price)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {n.pajak_name ? `${n.pajak_name} (${n.pajak_percentage}%)` : '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {formatRupiah(pajakCostOf(n))}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {formatRupiah(totalBillOf(n))}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {formatRupiah(n.total_cost)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {formatRupiah(n.total_price - n.total_cost)}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words">{n.notes ?? '-'}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          </div>

          <h2 className="text-sm font-bold">Payment</h2>
          <div className="h-[50vh] overflow-y-auto rounded-md border border-[oklch(0.84_0_0)] bg-panel [&_tr]:border-[oklch(0.86_0_0)]">
            <Table className="w-full table-fixed text-xs [&_th]:h-8 [&_td]:py-1.5">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px] pl-3 font-bold">Payment ID</TableHead>
                  <TableHead className="w-[85px] font-bold">Date</TableHead>
                  <TableHead className="w-[110px] font-bold">Method</TableHead>
                  <TableHead className="w-[130px] text-right font-bold">Amount</TableHead>
                  <TableHead className="w-[75px] font-bold">Evidence</TableHead>
                  <TableHead className="font-bold">Notes</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!modalPayments ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Loading payments…
                    </TableCell>
                  </TableRow>
                ) : modalPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No Payment Yet
                    </TableCell>
                  </TableRow>
                ) : (
                  modalPayments.map((payment) => (
                    <TableRow
                      key={payment.payment_id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSeePaymentPdf(company, payment)}
                    >
                      <TableCell className="whitespace-nowrap pl-3">
                        {payment.payment_number ?? payment.payment_id}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{payment.payment_date}</TableCell>
                      <TableCell className="whitespace-nowrap">{payment.method}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {formatRupiah(payment.amount)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {payment.evidence_key ? (
                          <a
                            href={getPaymentEvidenceUrl(payment.payment_id)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            View
                          </a>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words">
                        {payment.reference ?? '-'}
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
                            <DropdownMenuItem onClick={() => handleDownloadPaymentPdf(company, payment)}>
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeletePayment({ company: company.company, payment })}
                            >
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
        </div>

        {sharedDialogs}
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-[40vh]">
      <div className="flex items-center justify-center gap-6 rounded-lg border border-[oklch(0.8_0_0)] bg-panel py-4">
        <Button
          type="button"
          variant="default"
          size="icon"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="w-56 text-center text-2xl font-bold">{monthLabel}</span>
        <Button
          type="button"
          variant="default"
          size="icon"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-3">
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Total Nota</p>
            <p className="text-[22px] leading-tight font-semibold tabular-nums">{totals.notaCount}</p>
            <p className="text-xs text-muted-foreground">
              From {allCompanies.length} Customer
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Total Bill</p>
            <p className="text-[22px] leading-tight font-semibold tabular-nums break-all">
              {formatRupiah(totals.totalBill)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Profit</p>
            <p className="text-[22px] leading-tight font-semibold tabular-nums break-all">
              {formatRupiah(totalProfit)}
            </p>
            <p className="text-xs text-muted-foreground">
              Cost: {formatRupiah(totalCost)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm" className="border-green-200 bg-green-50">
          <CardContent>
            <p className="text-xs text-green-800">Total Paid</p>
            <p className="text-[22px] leading-tight font-semibold tabular-nums break-all text-green-700">
              {formatRupiah(totals.totalPaid)}
            </p>
            <p className="text-xs text-green-700">{settledCompanyCount} Customer Settled</p>
          </CardContent>
        </Card>
        <Card size="sm" className="border-red-200 bg-red-50">
          <CardContent>
            <p className="text-xs text-red-800">Total Unpaid</p>
            <p className="text-[22px] leading-tight font-semibold tabular-nums break-all text-red-700">
              {formatRupiah(totals.totalUnpaid)}
            </p>
            <p className="text-xs text-red-700">{unsettledCompanyCount} Customer Unsettled</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search customer or contact name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-80"
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partial">Partially Paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          {(search || status !== 'all') && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setStatus('all')
              }}
            >
              Clear
            </Button>
          )}
        </div>
        <Button onClick={onAddNota}>+ Add Nota</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-panel shadow-sm border-[oklch(0.84_0_0)] [&_tr]:border-[oklch(0.86_0_0)]">
          <Table className="table-fixed text-sm font-normal [&_td]:py-2">
            <colgroup>
              <col className="w-48" />
              <col className="w-20" />
              <col className="w-32" />
              <col className="w-36" />
              <col className="w-32" />
              <col className="w-40" />
              <col className="w-24" />
              <col />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="h-12 bg-panel font-bold">Company</TableHead>
                <TableHead className="h-12 bg-panel text-right font-bold">Nota Count</TableHead>
                <TableHead className="h-12 bg-panel text-right font-bold">Total Bill</TableHead>
                <TableHead className="h-12 bg-panel text-right font-bold">Cost</TableHead>
                <TableHead className="h-12 bg-panel text-right font-bold">Profit</TableHead>
                <TableHead className="h-12 bg-panel text-right font-bold">Paid</TableHead>
                <TableHead className="h-12 bg-panel font-bold">Status</TableHead>
                <TableHead className="h-12 bg-panel text-right font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No nota found for {monthLabel}.
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((company) => {
                const companyState = companyStatus(company)
                const companyCost = company.nota.reduce((sum, n) => sum + n.total_cost, 0)
                const companyPajakCost = company.nota.reduce((sum, n) => sum + pajakCostOf(n), 0)
                return (
                  <Fragment key={company.company}>
                    <TableRow
                      className="h-9 cursor-pointer font-normal bg-panel hover:bg-accent/40"
                      onClick={() => toggleCompany(company)}
                    >
                      <TableCell className="truncate pl-2" title={company.company}>
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{company.company}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{company.notaCount}</TableCell>
                      <TableCell className="text-right">
                        {formatRupiah(company.totalBill + companyPajakCost)}
                      </TableCell>
                      <TableCell className="text-right text-xs leading-tight">
                        <div>Cost: {formatRupiah(companyCost)}</div>
                        <div>Tax: {formatRupiah(companyPajakCost)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatRupiah(company.totalBill - companyCost)}
                      </TableCell>
                      <TableCell className="whitespace-normal text-right text-xs leading-tight">
                        <div>{formatRupiah(company.totalPaid)}</div>
                        {company.totalUnpaid > 0 && (
                          <div className="text-muted-foreground">
                            ({formatRupiah(company.totalUnpaid)} unpaid)
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={statusPillClass(companyState)}>{statusLabel(companyState)}</span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            className="shadow-xs"
                            onClick={() => handlePrintBill(company)}
                          >
                            Print Bill
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            className="shadow-xs"
                            onClick={() => {
                              setPaymentDialogCompany(company.company)
                              setPaymentDialogCustomerId(company.nota[0].customer_id)
                              setPaymentDialogDefaultAmount(company.totalUnpaid)
                            }}
                          >
                            Add Payment
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                )
              })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {sharedDialogs}
    </div>
  )
}
