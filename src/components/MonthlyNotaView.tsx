import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Download, MoreHorizontal } from 'lucide-react'
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
import { formatRupiah } from '@/lib/currency'
import { downloadNotaPdf } from '@/lib/notaPdf'
import {
  billPeriodOf,
  getNota,
  getPaymentEvidenceUrl,
  listBillPayments,
  statusPillClass,
  type NotaListItem,
  type Payment,
} from '@/lib/nota'
import { previewPaymentPdfUrl } from '@/lib/paymentPdf'
import { queryKeys, useBusinessQuery, useNotaListQuery, useVoidNotaMutation } from '@/lib/queries'

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => String(CURRENT_YEAR - i))

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

interface SettlementGroup extends Totals {
  key: 'unsettled' | 'settled'
  label: string
  companies: CompanyGroup[]
}

interface MonthGroup extends Totals {
  key: string
  label: string
  settlementGroups: SettlementGroup[]
}

function outstandingOf(n: NotaListItem): number {
  return n.status === 'void' ? 0 : n.total_price - n.paid_amount
}

function isSettled(n: NotaListItem): boolean {
  return outstandingOf(n) === 0
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

function sumTotals(nota: NotaListItem[]): Totals {
  return {
    notaCount: nota.length,
    totalBill: nota.reduce((sum, n) => sum + n.total_price, 0),
    totalUnpaid: nota.reduce((sum, n) => sum + outstandingOf(n), 0),
    totalPaid: nota.reduce((sum, n) => sum + n.paid_amount, 0),
  }
}

function groupByMonth(nota: NotaListItem[]): MonthGroup[] {
  const months = new Map<string, Map<string, NotaListItem[]>>()

  for (const n of nota) {
    const monthKey = n.nota_date.slice(0, 7)
    if (!months.has(monthKey)) months.set(monthKey, new Map())
    const companies = months.get(monthKey)!
    const list = companies.get(n.customer_company_name_snapshot) ?? []
    list.push(n)
    companies.set(n.customer_company_name_snapshot, list)
  }

  const result: MonthGroup[] = Array.from(months.entries()).map(([monthKey, companies]) => {
    const [year, month] = monthKey.split('-')
    const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })

    const allNotaInMonth = Array.from(companies.values()).flat()
    const unsettled = allNotaInMonth.filter((n) => !isSettled(n))
    const settled = allNotaInMonth.filter((n) => isSettled(n))

    const settlementGroups: SettlementGroup[] = (
      [
        { key: 'unsettled' as const, label: 'Unsettled', nota: unsettled },
        { key: 'settled' as const, label: 'Settled', nota: settled },
      ] as const
    )
      .filter((g) => g.nota.length > 0)
      .map((g) => ({
        key: g.key,
        label: g.label,
        companies: groupByCompany(g.nota),
        ...sumTotals(g.nota),
      }))

    return {
      key: monthKey,
      label,
      settlementGroups,
      ...sumTotals(allNotaInMonth),
    }
  })

  return result.sort((a, b) => (a.key < b.key ? 1 : -1))
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

export function MonthlyNotaView({
  onAddNota,
  onSelectNota,
}: {
  onAddNota: () => void
  onSelectNota: (notaId: number) => void
}) {
  const queryClient = useQueryClient()
  const { data: business } = useBusinessQuery()
  const voidMutation = useVoidNotaMutation()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [year, setYear] = useState(String(CURRENT_YEAR))
  const [openMonth, setOpenMonth] = useState<string | null>(null)
  const [openSettlement, setOpenSettlement] = useState<string | null>(null)
  const [openCompany, setOpenCompany] = useState<string | null>(null)
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

  const { data: notaPage, isLoading: loading } = useNotaListQuery({
    q: debouncedSearch || undefined,
    status: status !== 'all' ? status : undefined,
    startDate: year !== 'all' ? `${year}-01-01` : undefined,
    endDate: year !== 'all' ? `${year}-12-31` : undefined,
  })
  const nota = notaPage?.nota ?? []

  const months = groupByMonth(nota)

  function toggleMonth(key: string) {
    setOpenMonth((prev) => (prev === key ? null : key))
    setOpenSettlement(null)
    setOpenCompany(null)
    setExpandedNotaId(null)
  }

  function toggleSettlement(key: string) {
    setOpenSettlement((prev) => (prev === key ? null : key))
    setOpenCompany(null)
    setExpandedNotaId(null)
  }

  function toggleCompany(key: string) {
    setOpenCompany((prev) => (prev === key ? null : key))
    setExpandedNotaId(null)
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search customer or contact name…"
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
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(search || status !== 'all' || year !== String(CURRENT_YEAR)) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setStatus('all')
                setYear(String(CURRENT_YEAR))
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
      ) : months.length === 0 ? (
        <p className="text-sm text-muted-foreground">No nota found.</p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table className="table-fixed text-xs [&_th]:h-8 [&_td]:py-1.5">
            <colgroup>
              <col />
              <col className="w-24" />
              <col className="w-32" />
              <col className="w-32" />
              <col className="w-32" />
              <col className="w-28" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="font-bold">Month</TableHead>
                <TableHead className="text-right font-bold">Nota Count</TableHead>
                <TableHead className="text-right font-bold">Total Bill</TableHead>
                <TableHead className="text-right font-bold">Unpaid</TableHead>
                <TableHead className="text-right font-bold">Paid</TableHead>
                <TableHead className="font-bold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((month) => {
                const monthOpen = openMonth === month.key
                const monthSettled = month.totalPaid === month.totalBill
                return (
                  <Fragment key={month.key}>
                    <TableRow
                      className="h-9 cursor-pointer font-bold hover:bg-accent/50"
                      onClick={() => toggleMonth(month.key)}
                    >
                      <TableCell className="pl-2">
                        <div className="flex items-center gap-2">
                          <ChevronRight
                            className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${monthOpen ? 'rotate-90' : ''}`}
                          />
                          {month.label}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{month.notaCount}</TableCell>
                      <TableCell className="text-right">{formatRupiah(month.totalBill)}</TableCell>
                      <TableCell className="text-right">
                        {formatRupiah(month.totalUnpaid)}
                      </TableCell>
                      <TableCell className="text-right">{formatRupiah(month.totalPaid)}</TableCell>
                      <TableCell>
                        <span
                          className={
                            monthSettled
                              ? 'rounded bg-green-100 px-2 py-0.5 text-green-700'
                              : 'rounded bg-amber-100 px-2 py-0.5 text-amber-700'
                          }
                        >
                          {monthSettled ? 'Settled' : 'Unsettled'}
                        </span>
                      </TableCell>
                    </TableRow>

                    <DrawerRow open={monthOpen} colSpan={6}>
                      <Table className="table-fixed text-xs [&_th]:h-8 [&_td]:py-1.5">
                        <colgroup>
                          <col />
                          <col className="w-24" />
                          <col className="w-32" />
                          <col className="w-32" />
                          <col className="w-32" />
                          <col className="w-28" />
                        </colgroup>
                        <TableBody>
                          {month.settlementGroups.map((settlement) => {
                            const settlementKey = `${month.key}|${settlement.key}`
                            const settlementOpen = openSettlement === settlementKey
                            return (
                              <Fragment key={settlementKey}>
                                <TableRow
                                  className="h-9 cursor-pointer bg-muted/20 font-semibold hover:bg-muted/40"
                                  onClick={() => toggleSettlement(settlementKey)}
                                >
                                  <TableCell
                                    className={`w-auto pl-7 ${settlement.key === 'settled' ? 'text-green-700' : 'text-amber-700'}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <ChevronRight
                                        className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${settlementOpen ? 'rotate-90' : ''}`}
                                      />
                                      {settlement.label}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {settlement.notaCount}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatRupiah(settlement.totalBill)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatRupiah(settlement.totalUnpaid)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatRupiah(settlement.totalPaid)}
                                  </TableCell>
                                  <TableCell />
                                </TableRow>

                                <DrawerRow open={settlementOpen} colSpan={6}>
                                  <Table className="table-fixed text-xs [&_th]:h-8 [&_td]:py-1.5">
                                    <colgroup>
                                      <col />
                                      <col className="w-24" />
                                      <col className="w-32" />
                                      <col className="w-32" />
                                      <col className="w-32" />
                                      <col className="w-28" />
                                    </colgroup>
                                    <TableBody>
                                      {settlement.companies.map((company) => {
                                        const companyKey = `${settlementKey}|${company.company}`
                                        const companyOpen = openCompany === companyKey
                                        return (
                                          <Fragment key={companyKey}>
                                            <TableRow
                                              className="h-9 cursor-pointer bg-muted/30 hover:bg-muted/50"
                                              onClick={() => toggleCompany(companyKey)}
                                            >
                                              <TableCell className="w-auto pl-12">
                                                <div className="flex items-center gap-2">
                                                  <ChevronRight
                                                    className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${companyOpen ? 'rotate-90' : ''}`}
                                                  />
                                                  {company.company}
                                                </div>
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {company.notaCount}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {formatRupiah(company.totalBill)}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {formatRupiah(company.totalUnpaid)}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {formatRupiah(company.totalPaid)}
                                              </TableCell>
                                              <TableCell
                                                className={
                                                  company.totalPaid === company.totalBill
                                                    ? 'text-green-700'
                                                    : 'text-amber-700'
                                                }
                                              >
                                                {company.totalPaid === company.totalBill
                                                  ? 'Settled'
                                                  : 'Unsettled'}
                                              </TableCell>
                                            </TableRow>

                                            <DrawerRow
                                              open={companyOpen}
                                              colSpan={6}
                                              className="bg-background">
                                  <Table className="text-xs [&_th]:h-8 [&_td]:py-1.5">
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-8" />
                                        <TableHead className="font-bold">Nota Number</TableHead>
                                        <TableHead className="font-bold">Date</TableHead>
                                        <TableHead className="text-right font-bold">Total</TableHead>
                                        <TableHead className="text-right font-bold">Unpaid</TableHead>
                                        <TableHead className="text-right font-bold">Paid</TableHead>
                                        <TableHead className="font-bold">Status</TableHead>
                                        <TableHead className="w-px whitespace-nowrap" />
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {company.nota.map((n) => {
                                        const isExpanded = expandedNotaId === n.nota_id
                                        const payments = paymentsByNota[n.nota_id]
                                        const canSeePayment = n.status !== 'unpaid'
                                        return (
                                          <Fragment key={n.nota_id}>
                                            <TableRow
                                              className="h-9 cursor-pointer hover:bg-accent/50"
                                              onClick={() => onSelectNota(n.nota_id)}
                                            >
                                              <TableCell className="pl-16" />
                                              <TableCell>{n.nota_number}</TableCell>
                                              <TableCell>{n.nota_date}</TableCell>
                                              <TableCell className="text-right">
                                                {formatRupiah(n.total_price)}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {formatRupiah(outstandingOf(n))}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {formatRupiah(n.paid_amount)}
                                              </TableCell>
                                              <TableCell>
                                                <span
                                                  className={`capitalize ${statusPillClass(n.status)}`}
                                                >
                                                  {n.status}
                                                </span>
                                              </TableCell>
                                              <TableCell
                                                className="relative left-[-8px] flex items-center gap-3 whitespace-nowrap pl-0"
                                                onClick={(e) => e.stopPropagation()}
                                              >
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
                                                        setPaymentDialogDefaultAmount(
                                                          n.total_price - n.paid_amount,
                                                        )
                                                      }}
                                                    >
                                                      Add Payment
                                                    </DropdownMenuItem>
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
                                                <button
                                                  type="button"
                                                  className={`text-xs text-primary underline ${canSeePayment ? '' : 'invisible pointer-events-none'}`}
                                                  tabIndex={canSeePayment ? undefined : -1}
                                                  onClick={() => toggleExpandNota(n)}
                                                >
                                                  See Payment
                                                </button>
                                              </TableCell>
                                            </TableRow>

                                            <DrawerRow
                                              open={isExpanded}
                                              colSpan={8}
                                              className="bg-muted/30 pl-28"
                                            >
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
                                                    <TableHead className="font-bold">
                                                      Payment Number
                                                    </TableHead>
                                                    <TableHead className="font-bold">
                                                      Payment Date
                                                    </TableHead>
                                                    <TableHead className="text-right font-bold">
                                                      Amount
                                                    </TableHead>
                                                    <TableHead className="font-bold">
                                                      Method
                                                    </TableHead>
                                                    <TableHead className="font-bold">
                                                      Evidence
                                                    </TableHead>
                                                    <TableHead className="font-bold">
                                                      Notes
                                                    </TableHead>
                                                    <TableHead className="w-8" />
                                                  </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                  {!payments ? (
                                                    <TableRow>
                                                      <TableCell
                                                        colSpan={7}
                                                        className="text-center text-muted-foreground"
                                                      >
                                                        Loading payments…
                                                      </TableCell>
                                                    </TableRow>
                                                  ) : payments.length === 0 ? (
                                                    <TableRow>
                                                      <TableCell
                                                        colSpan={7}
                                                        className="text-center text-muted-foreground"
                                                      >
                                                        No Payment Yet
                                                      </TableCell>
                                                    </TableRow>
                                                  ) : (
                                                    payments.map((p) => (
                                                      <TableRow key={p.payment_id}>
                                                        <TableCell className="truncate">
                                                          {p.payment_number ?? '-'}
                                                        </TableCell>
                                                        <TableCell className="truncate">
                                                          {p.payment_date}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                          {formatRupiah(p.amount)}
                                                        </TableCell>
                                                        <TableCell className="truncate">
                                                          {p.method ?? '-'}
                                                        </TableCell>
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
                                                            onClick={() =>
                                                              handleSeePaymentPdf(n, p)
                                                            }
                                                          >
                                                            <Download className="h-3.5 w-3.5" />
                                                            Download PDF
                                                          </Button>
                                                        </TableCell>
                                                      </TableRow>
                                                    ))
                                                  )}
                                                </TableBody>
                                              </Table>
                                            </DrawerRow>
                                          </Fragment>
                                        )
                                      })}
                                    </TableBody>
                                  </Table>
                                </DrawerRow>
                              </Fragment>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </DrawerRow>
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </DrawerRow>
      </Fragment>
    )
  })}
            </TableBody>
          </Table>
        </div>
      )}

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
