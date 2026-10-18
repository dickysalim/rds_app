import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
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
import { getNota, listBillPayments, statusLabel, statusPillClass, voidPayment, type NotaListItem, type Payment } from '@/lib/nota'
import { downloadNotaPdf } from '@/lib/notaPdf'
import { downloadPaymentPdf, previewPaymentPdfUrl } from '@/lib/paymentPdf'
import {
  queryKeys,
  useBusinessQuery,
  useCustomersQuery,
  useNotaListQuery,
  useVoidNotaMutation,
} from '@/lib/queries'

interface Totals {
  notaCount: number
  totalBill: number
  totalUnpaid: number
  totalPaid: number
}

interface CompanyGroup extends Totals {
  company: string
  nota: NotaListItem[]
}

function outstandingOf(n: NotaListItem): number {
  return n.status === 'void' ? 0 : n.total_price - n.paid_amount
}

function companyStatus(c: Totals): 'paid' | 'unpaid' | 'partial' {
  if (c.totalUnpaid <= 0) return 'paid'
  if (c.totalPaid <= 0) return 'unpaid'
  return 'partial'
}

function sumTotals(nota: NotaListItem[]): Totals {
  return {
    notaCount: nota.length,
    totalBill: nota.reduce((sum, n) => sum + n.total_price, 0),
    totalUnpaid: nota.reduce((sum, n) => sum + outstandingOf(n), 0),
    totalPaid: nota.reduce((sum, n) => sum + n.paid_amount, 0),
  }
}

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
    .sort((a, b) => b.totalUnpaid - a.totalUnpaid || a.company.localeCompare(b.company))
}

function DrawerRow({
  open,
  colSpan,
  className,
  children,
}: {
  open: boolean
  colSpan: number
  className?: string
  children: ReactNode
}) {
  return (
    <TableRow className="border-0 hover:bg-transparent">
      <TableCell
        colSpan={colSpan}
        className="p-0 leading-none"
        style={{ lineHeight: 0, padding: 0 }}
      >
        <div
          className="grid min-h-0 transition-[grid-template-rows] duration-300 ease-in-out"
          style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        >
          <div className={`min-h-0 overflow-hidden ${className ?? ''}`}>{children}</div>
        </div>
      </TableCell>
    </TableRow>
  )
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

export function CompanyOverviewView({
  onAddNota,
  onSelectNota,
}: {
  onAddNota: () => void
  onSelectNota: (notaId: number) => void
}) {
  const queryClient = useQueryClient()
  const { data: business } = useBusinessQuery()
  const { data: customers = [] } = useCustomersQuery()
  const voidMutation = useVoidNotaMutation()
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
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

  const { data: notaPage, isLoading: loading } = useNotaListQuery({
    q: debouncedSearch || undefined,
    month: String(selectedMonth).padStart(2, '0'),
    year: String(selectedYear),
  })
  const nota = notaPage?.nota ?? []

  const allCompanies = groupByCompany(nota)
  const companies = allCompanies.filter((c) => {
    if (status === 'all') return true
    return companyStatus(c) === status
  })
  const monthLabel = MONTH_FORMATTER.format(new Date(selectedYear, selectedMonth - 1, 1))

  const totals = sumTotals(nota)
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
    const opening = openCompany !== key
    setOpenCompany(opening ? key : null)
    if (opening && !paymentsByCompany[key]) {
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

  return (
    <div className="space-y-4 pb-[40vh]">
      <div className="flex items-center justify-center gap-6 rounded-lg border border-[oklch(0.8_0_0)] bg-white py-4">
        <Button type="button" variant="default" size="icon" onClick={() => shiftMonth(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="w-56 text-center text-2xl font-bold">{monthLabel}</span>
        <Button type="button" variant="default" size="icon" onClick={() => shiftMonth(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-3">
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Total Nota</p>
            <p className="text-[22px] leading-tight font-semibold tabular-nums">{totals.notaCount}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Total Company</p>
            <p className="text-[22px] leading-tight font-semibold tabular-nums">{allCompanies.length}</p>
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
        <Card size="sm" className="border-green-200 bg-green-50">
          <CardContent>
            <p className="text-xs text-green-800">Total Paid</p>
            <p className="text-[22px] leading-tight font-semibold tabular-nums break-all text-green-700">
              {formatRupiah(totals.totalPaid)}
            </p>
            <p className="text-xs text-green-700">{settledCompanyCount} Company Settled</p>
          </CardContent>
        </Card>
        <Card size="sm" className="border-red-200 bg-red-50">
          <CardContent>
            <p className="text-xs text-red-800">Total Unpaid</p>
            <p className="text-[22px] leading-tight font-semibold tabular-nums break-all text-red-700">
              {formatRupiah(totals.totalUnpaid)}
            </p>
            <p className="text-xs text-red-700">{unsettledCompanyCount} Company Unsettled</p>
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
      ) : companies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No nota found for {monthLabel}.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-white shadow-sm border-[oklch(0.84_0_0)] [&_tr]:border-[oklch(0.86_0_0)]">
          <Table className="table-fixed text-sm font-normal [&_td]:py-2">
            <colgroup>
              <col className="w-40" />
              <col className="w-16" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-44" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="h-12 bg-white font-bold">Company</TableHead>
                <TableHead className="h-12 bg-white text-right font-bold">Nota Count</TableHead>
                <TableHead className="h-12 bg-white text-right font-bold">Total Bill</TableHead>
                <TableHead className="h-12 bg-white text-right font-bold">Unpaid</TableHead>
                <TableHead className="h-12 bg-white text-right font-bold">Paid</TableHead>
                <TableHead className="h-12 bg-white font-bold">Status</TableHead>
                <TableHead className="h-12 bg-white text-right font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => {
                const companyOpen = openCompany === company.company
                const companyPayments = paymentsByCompany[company.company]
                const companyState = companyStatus(company)
                return (
                  <Fragment key={company.company}>
                    <TableRow
                      className="h-9 cursor-pointer font-normal bg-white hover:bg-accent/40"
                      onClick={() => toggleCompany(company)}
                    >
                      <TableCell className="truncate pl-2" title={company.company}>
                        <div className="flex items-center gap-1.5">
                          <ChevronDown
                            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${companyOpen ? '' : '-rotate-90'}`}
                          />
                          <span className="truncate">{company.company}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{company.notaCount}</TableCell>
                      <TableCell className="text-right">{formatRupiah(company.totalBill)}</TableCell>
                      <TableCell className="text-right">
                        {formatRupiah(company.totalUnpaid)}
                      </TableCell>
                      <TableCell className="text-right">{formatRupiah(company.totalPaid)}</TableCell>
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

                    <DrawerRow open={companyOpen} colSpan={7} className="bg-white">
                      <div className="grid grid-cols-2 divide-x">
                        <Table className="w-full table-fixed text-xs [&_th]:h-8 [&_td]:py-1.5">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="pl-6 font-bold">Nota Number</TableHead>
                              <TableHead className="font-bold">Date</TableHead>
                              <TableHead className="text-right font-bold">Total</TableHead>
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
                                <TableCell className="truncate pl-6">{n.nota_number}</TableCell>
                                <TableCell className="truncate">{n.nota_date}</TableCell>
                                <TableCell className="text-right">
                                  {formatRupiah(n.total_price)}
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
                                      <DropdownMenuItem
                                        onClick={() => handleDownloadPdf(n.nota_id)}
                                      >
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

                        <Table className="w-full table-fixed text-xs [&_th]:h-8 [&_td]:py-1.5">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="pl-3 font-bold">Payment ID</TableHead>
                              <TableHead className="font-bold">Date</TableHead>
                              <TableHead className="font-bold">Method</TableHead>
                              <TableHead className="text-right font-bold">Amount</TableHead>
                              <TableHead className="w-10" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {!companyPayments ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                  Loading payments…
                                </TableCell>
                              </TableRow>
                            ) : companyPayments.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                  No Payment Yet
                                </TableCell>
                              </TableRow>
                            ) : (
                              companyPayments.map((payment) => (
                                <TableRow
                                  key={payment.payment_id}
                                  className="cursor-pointer hover:bg-accent/50"
                                  onClick={() => handleSeePaymentPdf(company, payment)}
                                >
                                  <TableCell className="pl-3 truncate">
                                    {payment.payment_number ?? payment.payment_id}
                                  </TableCell>
                                  <TableCell className="truncate">{payment.payment_date}</TableCell>
                                  <TableCell className="truncate">{payment.method}</TableCell>
                                  <TableCell className="text-right">
                                    {formatRupiah(payment.amount)}
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
                                        <DropdownMenuItem
                                          onClick={() => handleDownloadPaymentPdf(company, payment)}
                                        >
                                          Download PDF
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          variant="destructive"
                                          onClick={() =>
                                            setDeletePayment({ company: company.company, payment })
                                          }
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
                    </DrawerRow>
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
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
      <Dialog
        open={billPdfLoading || billPdfUrl !== null || billPdfError !== null}
        onOpenChange={(open) => !open && closeBillPdf()}
      >
        <DialogContent className="max-w-5xl sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Tagihan</DialogTitle>
          </DialogHeader>
          {billPdfLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Generating…</p>
          ) : billPdfError ? (
            <p className="py-8 text-center text-sm text-destructive">{billPdfError}</p>
          ) : billPdfUrl ? (
            <iframe
              title="Bill PDF"
              src={billPdfUrl}
              className="h-[80vh] w-full rounded-md border"
            />
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
    </div>
  )
}
