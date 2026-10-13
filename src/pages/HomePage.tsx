import { ChevronDown, ChevronRight } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { NotaDetailPanel } from '@/components/NotaDetailPanel'
import { formatRupiah } from '@/lib/currency'
import { getPaymentEvidenceUrl, listNota, listPayments, type NotaListItem, type Payment } from '@/lib/nota'

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

export function HomePage() {
  const [nota, setNota] = useState<NotaListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())
  const [openCompanies, setOpenCompanies] = useState<Set<string>>(new Set())
  const [selectedNotaId, setSelectedNotaId] = useState<number | null>(null)
  const [expandedNotaId, setExpandedNotaId] = useState<number | null>(null)
  const [paymentsByNota, setPaymentsByNota] = useState<Record<number, Payment[]>>({})

  useEffect(() => {
    listNota()
      .then((rows) => {
        setNota(rows)
        const months = groupByMonth(rows)
        if (months[0]) setOpenMonths(new Set([months[0].key]))
      })
      .finally(() => setLoading(false))
  }, [])

  const months = useMemo(() => groupByMonth(nota), [nota])

  function toggleMonth(key: string) {
    setOpenMonths((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleCompany(key: string) {
    setOpenCompanies((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
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
          <Table className="text-xs [&_th]:h-8 [&_th]:px-2 [&_td]:px-2 [&_td]:py-1.5">
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Nota Count</TableHead>
                <TableHead className="text-right">Total Bill</TableHead>
                <TableHead className="text-right">Unpaid</TableHead>
                <TableHead className="text-right">Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((month) => {
                const monthOpen = openMonths.has(month.key)
                return (
                  <Fragment key={month.key}>
                    <TableRow
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => toggleMonth(month.key)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {monthOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          {month.label}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{month.notaCount}</TableCell>
                      <TableCell className="text-right">{formatRupiah(month.totalBill)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatRupiah(month.totalUnpaid)}
                      </TableCell>
                      <TableCell className="text-right">{formatRupiah(month.totalPaid)}</TableCell>
                    </TableRow>

                    {monthOpen &&
                      month.companies.map((company) => {
                        const companyKey = `${month.key}|${company.company}`
                        const companyOpen = openCompanies.has(companyKey)
                        return (
                          <Fragment key={companyKey}>
                            <TableRow
                              className="cursor-pointer bg-muted/30 hover:bg-muted/50"
                              onClick={() => toggleCompany(companyKey)}
                            >
                              <TableCell className="pl-8">
                                <div className="flex items-center gap-2">
                                  {companyOpen ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
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
                            </TableRow>

                            {companyOpen && (
                              <TableRow key={`${companyKey}-detail`}>
                                <TableCell colSpan={5} className="bg-background p-0 pl-14">
                                  <Table className="text-xs [&_th]:h-8 [&_th]:px-2 [&_td]:px-2 [&_td]:py-1.5">
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-8" />
                                        <TableHead>Nota Number</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Unpaid</TableHead>
                                        <TableHead className="text-right">Paid</TableHead>
                                        <TableHead>Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {company.nota.map((n) => {
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
                                                    toggleExpandNota(n.nota_id)
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
                                              <TableCell className="text-right">
                                                {formatRupiah(n.total_price)}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {formatRupiah(outstandingOf(n))}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {formatRupiah(n.paid_amount)}
                                              </TableCell>
                                              <TableCell className="capitalize">{n.status}</TableCell>
                                            </TableRow>

                                            {isExpanded && (
                                              <TableRow>
                                                <TableCell colSpan={7} className="bg-muted/30 pl-10">
                                                  {!payments ? (
                                                    <p className="py-2 text-muted-foreground">
                                                      Loading payments…
                                                    </p>
                                                  ) : payments.length === 0 ? (
                                                    <p className="py-2 text-muted-foreground">
                                                      No payments yet.
                                                    </p>
                                                  ) : (
                                                    <Table className="text-xs [&_th]:h-8 [&_th]:px-2 [&_td]:px-2 [&_td]:py-1.5">
                                                      <TableHeader>
                                                        <TableRow>
                                                          <TableHead>Payment Number</TableHead>
                                                          <TableHead>Payment Date</TableHead>
                                                          <TableHead className="text-right">
                                                            Amount
                                                          </TableHead>
                                                          <TableHead>Method</TableHead>
                                                          <TableHead>Reference</TableHead>
                                                          <TableHead>Evidence</TableHead>
                                                        </TableRow>
                                                      </TableHeader>
                                                      <TableBody>
                                                        {payments.map((p) => (
                                                          <TableRow key={p.payment_id}>
                                                            <TableCell>
                                                              {p.payment_number ?? '-'}
                                                            </TableCell>
                                                            <TableCell>{p.payment_date}</TableCell>
                                                            <TableCell className="text-right">
                                                              {formatRupiah(p.amount)}
                                                            </TableCell>
                                                            <TableCell>{p.method ?? '-'}</TableCell>
                                                            <TableCell>{p.reference ?? '-'}</TableCell>
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
                                      })}
                                    </TableBody>
                                  </Table>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        )
                      })}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
