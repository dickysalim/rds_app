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
import { listNota, type NotaListItem } from '@/lib/nota'

interface CompanyGroup {
  company: string
  totalUnpaid: number
  nota: NotaListItem[]
}

interface MonthGroup {
  key: string
  label: string
  totalUnpaid: number
  companies: CompanyGroup[]
}

function outstandingOf(n: NotaListItem): number {
  return n.status === 'void' ? 0 : n.total_price - n.paid_amount
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
        totalUnpaid: list.reduce((sum, n) => sum + outstandingOf(n), 0),
        nota: [...list].sort((a, b) => (a.nota_date < b.nota_date ? 1 : -1)),
      }))
      .sort((a, b) => b.totalUnpaid - a.totalUnpaid || a.company.localeCompare(b.company))

    return {
      key: monthKey,
      label,
      totalUnpaid: companyGroups.reduce((sum, c) => sum + c.totalUnpaid, 0),
      companies: companyGroups,
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Total Unpaid</TableHead>
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
                      <TableCell className="text-right font-medium">
                        {formatRupiah(month.totalUnpaid)}
                      </TableCell>
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
                              <TableCell className="text-right">
                                {formatRupiah(company.totalUnpaid)}
                              </TableCell>
                            </TableRow>

                            {companyOpen && (
                              <TableRow key={`${companyKey}-detail`}>
                                <TableCell colSpan={2} className="bg-background p-0 pl-14">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Nota Number</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Paid</TableHead>
                                        <TableHead>Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {company.nota.map((n) => (
                                        <TableRow
                                          key={n.nota_id}
                                          className="cursor-pointer hover:bg-accent/50"
                                          onClick={() => setSelectedNotaId(n.nota_id)}
                                        >
                                          <TableCell>{n.nota_number}</TableCell>
                                          <TableCell>{n.nota_date}</TableCell>
                                          <TableCell className="text-right">
                                            {formatRupiah(n.total_price)}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            {formatRupiah(n.paid_amount)}
                                          </TableCell>
                                          <TableCell className="capitalize">{n.status}</TableCell>
                                        </TableRow>
                                      ))}
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
