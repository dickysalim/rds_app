import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
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
import { NotaDetailPanel } from '@/components/NotaDetailPanel'
import { getBusiness } from '@/lib/business'
import { formatRupiah } from '@/lib/currency'
import { downloadNotaPdf } from '@/lib/notaPdf'
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

interface MonthGroup extends Totals {
  key: string
  label: string
  companies: CompanyGroup[]
}

function outstandingOf(n: NotaListItem): number {
  return n.status === 'void' ? 0 : n.total_price - n.paid_amount
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

    const companyGroups: CompanyGroup[] = Array.from(companies.entries())
      .map(([company, list]) => ({
        company,
        nota: [...list].sort((a, b) => (a.nota_date < b.nota_date ? 1 : -1)),
        ...sumTotals(list),
      }))
      .sort((a, b) => b.totalUnpaid - a.totalUnpaid || a.company.localeCompare(b.company))

    const allNotaInMonth = companyGroups.flatMap((c) => c.nota)

    return {
      key: monthKey,
      label,
      companies: companyGroups,
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

export function HomePage() {
  const [nota, setNota] = useState<NotaListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [openMonth, setOpenMonth] = useState<string | null>(null)
  const [openCompany, setOpenCompany] = useState<string | null>(null)
  const [selectedNotaId, setSelectedNotaId] = useState<number | null>(null)
  const [expandedNotaId, setExpandedNotaId] = useState<number | null>(null)
  const [paymentsByNota, setPaymentsByNota] = useState<Record<number, Payment[]>>({})
  const [paymentDialogNotaId, setPaymentDialogNotaId] = useState<number | null>(null)
  const [deleteNotaId, setDeleteNotaId] = useState<number | null>(null)

  useEffect(() => {
    listNota()
      .then(({ nota: rows }) => {
        setNota(rows)
        const months = groupByMonth(rows)
        if (months[0]) setOpenMonth(months[0].key)
      })
      .finally(() => setLoading(false))
  }, [])

  const months = useMemo(() => groupByMonth(nota), [nota])

  function toggleMonth(key: string) {
    setOpenMonth((prev) => (prev === key ? null : key))
    setOpenCompany(null)
    setExpandedNotaId(null)
  }

  function toggleCompany(key: string) {
    setOpenCompany((prev) => (prev === key ? null : key))
    setExpandedNotaId(null)
  }

  function toggleExpandNota(notaId: number) {
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
    listNota()
      .then(({ nota: rows }) => setNota(rows))
      .catch(() => {})
  }

  async function handleDownloadPdf(notaId: number) {
    try {
      const [nota, business] = await Promise.all([getNota(notaId), getBusiness()])
      if (!business) throw new Error('Set up Business Settings first')
      await downloadNotaPdf(nota, business)
    } catch {
      // ignore; user can retry from the row
    }
  }

  async function handleConfirmDelete() {
    if (deleteNotaId === null) return
    const notaId = deleteNotaId
    setDeleteNotaId(null)
    try {
      await voidNota(notaId)
      setNota((prev) => prev.filter((n) => n.nota_id !== notaId))
    } catch {
      // ignore; nota stays in list
    }
  }

  if (selectedNotaId !== null) {
    return <NotaDetailPanel notaId={selectedNotaId} onBack={() => setSelectedNotaId(null)} />
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Home</h1>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : months.length === 0 ? (
        <p className="text-sm text-muted-foreground">No nota yet.</p>
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
                          {month.companies.map((company) => {
                            const companyKey = `${month.key}|${company.company}`
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
                                  <TableCell className="text-right">{company.notaCount}</TableCell>
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

                                <DrawerRow open={companyOpen} colSpan={6} className="bg-background">
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
                                              onClick={() => setSelectedNotaId(n.nota_id)}
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
                                                      onClick={() => setPaymentDialogNotaId(n.nota_id)}
                                                    >
                                                      Make Payment
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
                                                  onClick={() => toggleExpandNota(n.nota_id)}
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
                                              <Table className="table-fixed text-xs [&_th]:h-8 [&_th]:px-1.5 [&_td]:px-1.5 [&_td]:py-1.5">
                                                <colgroup>
                                                  <col className="w-32" />
                                                  <col className="w-24" />
                                                  <col className="w-32" />
                                                  <col className="w-28" />
                                                  <col className="w-24" />
                                                  <col />
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
                                                  </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                  {!payments ? (
                                                    <TableRow>
                                                      <TableCell
                                                        colSpan={6}
                                                        className="text-center text-muted-foreground"
                                                      >
                                                        Loading payments…
                                                      </TableCell>
                                                    </TableRow>
                                                  ) : payments.length === 0 ? (
                                                    <TableRow>
                                                      <TableCell
                                                        colSpan={6}
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
                                                              href={getPaymentEvidenceUrl(
                                                                n.nota_id,
                                                                p.payment_id,
                                                              )}
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
        </div>
      )}

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
    </div>
  )
}
