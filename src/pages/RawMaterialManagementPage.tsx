import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ListFilter, MoreHorizontal } from 'lucide-react'
import { Fragment, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AppOutletContext } from '@/components/AppLayout'
import { EditRawMaterialMovementDialog } from '@/components/EditRawMaterialMovementDialog'
import { EditRawMaterialPriceDialog } from '@/components/EditRawMaterialPriceDialog'
import { PurchaseOrderPanel } from '@/components/PurchaseOrderPanel'
import { RawMaterialMovementDialog } from '@/components/RawMaterialMovementDialog'
import { hideFinancials } from '@/lib/access'
import { formatQty, formatRupiah } from '@/lib/currency'
import { useDeleteRawMaterialMovementMutation, useRawMaterialLedgerQuery } from '@/lib/queries'
import type { RawMaterialLedgerEntry } from '@/lib/rawMaterial'

const MOVEMENT_LABEL: Record<string, string> = {
  purchase_in: 'Purchase In',
  out_for_production: 'Out for Production',
  retur: 'Retur',
  stock_loss: 'Stock Loss',
  initial_stock: 'Initial Stock',
  adjustment_up: 'Adjustment Up',
  adjustment_down: 'Adjustment Down',
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
const DAILY_PAGE_SIZE = 50

function formatBusinessDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function FilterSection({
  label,
  options,
  selected,
  onToggle,
  onClear,
  searchable,
}: {
  label: string
  options: Array<[string, string]>
  selected: Set<string>
  onToggle: (value: string) => void
  onClear: () => void
  searchable?: boolean
}) {
  const [search, setSearch] = useState('')
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground">{label}</span>
        {selected.size > 0 && (
          <button type="button" className="text-xs text-primary hover:underline" onClick={onClear}>
            Clear ({selected.size})
          </button>
        )}
      </div>
      {searchable && (
        <Input
          placeholder={`Search ${label}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-1 bg-white"
        />
      )}
      <div className="max-h-60 overflow-y-auto">
        {options
          .filter(([, name]) => name.toLowerCase().includes(search.trim().toLowerCase()))
          .map(([id, name]) => {
            const checked = selected.has(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => onToggle(id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                  }`}
                >
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate">{name}</span>
              </button>
            )
          })}
      </div>
    </div>
  )
}

export function RawMaterialManagementPage() {
  const { user } = useOutletContext<AppOutletContext>()
  const hideCost = hideFinancials(user.role)
  const { data: entries = [], isLoading: loading } = useRawMaterialLedgerQuery()
  const [view, setView] = useState<'list' | 'add'>('list')
  const [search, setSearch] = useState('')
  const [rawMatFilter, setRawMatFilter] = useState<Set<string>>(new Set())
  const [createdByFilter, setCreatedByFilter] = useState<Set<string>>(new Set())
  const [movementTypeFilter, setMovementTypeFilter] = useState<Set<string>>(new Set())
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [deductDialogOpen, setDeductDialogOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())
  const [directionFilter, setDirectionFilter] = useState<'increase' | 'decrease' | null>(null)
  const [dailyPage, setDailyPage] = useState(1)
  const [expandedRawMatId, setExpandedRawMatId] = useState<number | null>(null)
  const [expandedPoKey, setExpandedPoKey] = useState<string | null>(null)
  const [editingEntry, setEditingEntry] = useState<RawMaterialLedgerEntry | null>(null)
  const [editingPriceEntry, setEditingPriceEntry] = useState<RawMaterialLedgerEntry | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<RawMaterialLedgerEntry | null>(null)
  const deleteMutation = useDeleteRawMaterialMovementMutation()

  async function handleDelete() {
    if (!deletingEntry) return
    await deleteMutation.mutateAsync(deletingEntry.id)
    setDeletingEntry(null)
  }

  if (view === 'add') {
    return <PurchaseOrderPanel onCancel={() => setView('list')} onSaved={() => setView('list')} />
  }

  const monthLabel = MONTH_FORMATTER.format(new Date(selectedYear, selectedMonth - 1, 1))

  function shiftMonth(delta: number) {
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

  function toggleExpanded(rawMatId: number) {
    setExpandedRawMatId((prev) => (prev === rawMatId ? null : rawMatId))
  }

  const periodEntries = entries.filter((entry) =>
    entry.date.startsWith(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`),
  )

  const rawMatOptions = Array.from(
    new Map(entries.map((entry) => [entry.raw_mat_id, entry.item_name ?? '-'])).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]))
  const createdByOptions: Array<[string, string]> = Array.from(
    new Set(entries.map((entry) => entry.created_by).filter((v): v is string => !!v)),
  )
    .sort((a, b) => a.localeCompare(b))
    .map((name) => [name, name])
  const movementTypeOptions: Array<[string, string]> = Array.from(
    new Set(entries.map((entry) => entry.movement_type)),
  )
    .sort((a, b) => a.localeCompare(b))
    .map((type) => [type, MOVEMENT_LABEL[type] ?? type])

  const totalFilterCount = rawMatFilter.size + createdByFilter.size + movementTypeFilter.size

  const monthEntries = periodEntries.filter(
    (entry) =>
      (rawMatFilter.size === 0 || rawMatFilter.has(String(entry.raw_mat_id))) &&
      (createdByFilter.size === 0 || (entry.created_by != null && createdByFilter.has(entry.created_by))) &&
      (movementTypeFilter.size === 0 || movementTypeFilter.has(entry.movement_type)),
  )

  const itemMap = new Map<
    number,
    { raw_mat_id: number; item_name: string; stockIncrease: number; stockDecrease: number; movements: typeof entries }
  >()
  for (const entry of monthEntries) {
    let item = itemMap.get(entry.raw_mat_id)
    if (!item) {
      item = { raw_mat_id: entry.raw_mat_id, item_name: entry.item_name ?? '-', stockIncrease: 0, stockDecrease: 0, movements: [] }
      itemMap.set(entry.raw_mat_id, item)
    }
    if (entry.qty > 0) item.stockIncrease += entry.qty
    else item.stockDecrease += Math.abs(entry.qty)
    item.movements.push(entry)
  }

  const items = Array.from(itemMap.values())
    .filter((item) => item.item_name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.item_name.localeCompare(b.item_name))

  const dailyEntries = entries
    .filter(
      (entry) =>
        (rawMatFilter.size === 0 || rawMatFilter.has(String(entry.raw_mat_id))) &&
        (createdByFilter.size === 0 || (entry.created_by != null && createdByFilter.has(entry.created_by))) &&
        (movementTypeFilter.size === 0 || movementTypeFilter.has(entry.movement_type)) &&
        (directionFilter === null || (directionFilter === 'increase' ? entry.qty > 0 : entry.qty < 0)) &&
        (entry.item_name ?? '-').toLowerCase().includes(search.trim().toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
  const dailyTotalPages = Math.max(1, Math.ceil(dailyEntries.length / DAILY_PAGE_SIZE))
  const dailyCurrentPage = Math.min(dailyPage, dailyTotalPages)
  const dailyPageEntries = dailyEntries.slice(
    (dailyCurrentPage - 1) * DAILY_PAGE_SIZE,
    dailyCurrentPage * DAILY_PAGE_SIZE,
  )

  // A "PO" isn't a real header row (see purchase_order_freetext) -- group
  // the purchase_in ledger rows created together by PO number + date, the
  // same grouping handleCreatePurchaseOrder uses when it batches the insert.
  const poGroupMap = new Map<string, { poNumber: string; date: string; movements: typeof entries }>()
  for (const entry of entries) {
    if (entry.movement_type === 'initial_stock') {
      // No PO freetext on these -- each unpriced initial-stock row stands as
      // its own one-item "group" so it still shows up here for pricing.
      if (entry.price != null) continue
      poGroupMap.set(`initial_stock__${entry.id}`, {
        poNumber: 'Initial Stock',
        date: entry.date,
        movements: [entry],
      })
      continue
    }
    if (entry.movement_type !== 'purchase_in' || !entry.purchase_order_freetext) continue
    const key = `${entry.purchase_order_freetext}__${entry.date}`
    let group = poGroupMap.get(key)
    if (!group) {
      group = { poNumber: entry.purchase_order_freetext, date: entry.date, movements: [] }
      poGroupMap.set(key, group)
    }
    group.movements.push(entry)
  }
  const poGroupsMissingPrice = Array.from(poGroupMap.entries())
    .filter(([, group]) => group.movements.some((m) => m.price == null))
    .sort((a, b) => b[1].date.localeCompare(a[1].date))

  function FilterDialogButton() {
    return (
      <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="gap-1.5 bg-white font-normal">
            <ListFilter className="h-4 w-4" />
            Filter
            {totalFilterCount > 0 && (
              <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
                {totalFilterCount}
              </span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Filter Raw Material Movements</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4">
            <FilterSection
              label="Raw Material"
              options={rawMatOptions.map(([id, name]): [string, string] => [String(id), name])}
              selected={rawMatFilter}
              onToggle={(id) =>
                setRawMatFilter((prev) => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }
              onClear={() => setRawMatFilter(new Set())}
              searchable
            />
            <FilterSection
              label="Users"
              options={createdByOptions}
              selected={createdByFilter}
              onToggle={(id) =>
                setCreatedByFilter((prev) => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }
              onClear={() => setCreatedByFilter(new Set())}
            />
            <FilterSection
              label="Movement Type"
              options={movementTypeOptions}
              selected={movementTypeFilter}
              onToggle={(id) =>
                setMovementTypeFilter((prev) => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }
              onClear={() => setMovementTypeFilter(new Set())}
            />
          </div>
          <DialogFooter className="sm:justify-between">
            {totalFilterCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRawMatFilter(new Set())
                  setCreatedByFilter(new Set())
                  setMovementTypeFilter(new Set())
                }}
              >
                Clear all filters
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" onClick={() => setFilterDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const overviewColSpan = 5
  const dailyColSpan = hideCost ? 8 : 9

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Raw Mat. Management</h1>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Monthly Overview</TabsTrigger>
          <TabsTrigger value="daily">Daily Movement</TabsTrigger>
          {!hideCost && <TabsTrigger value="price">Price Management</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="flex items-center justify-center gap-6 rounded-lg border border-[oklch(0.8_0_0)] bg-panel py-4">
            <Button type="button" variant="default" size="icon" onClick={() => shiftMonth(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="w-56 text-center text-2xl font-bold">{monthLabel}</span>
            <Button type="button" variant="default" size="icon" onClick={() => shiftMonth(1)}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search raw material name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-80"
              />
              <FilterDialogButton />
            </div>
            <div className="flex gap-2">
              <Button className="bg-[#3EA768] text-white hover:bg-[#357f52]" onClick={() => setView('add')}>
                + Add Raw Material
              </Button>
              <Button className="bg-red-600 text-white hover:bg-red-700" onClick={() => setDeductDialogOpen(true)}>
                Adjust Raw Material
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border bg-panel shadow-sm border-[oklch(0.84_0_0)] [&_tr]:border-[oklch(0.86_0_0)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Raw Mat. Name</TableHead>
                  <TableHead className="font-bold">Stock Increase</TableHead>
                  <TableHead className="font-bold">Stock Decrease</TableHead>
                  <TableHead className="font-bold">Net Stock Change</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={overviewColSpan} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={overviewColSpan} className="text-center text-muted-foreground">
                      {search || rawMatFilter.size > 0 || createdByFilter.size > 0 || movementTypeFilter.size > 0
                        ? 'No matching raw material movements.'
                        : `No raw material movements for ${monthLabel}.`}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                    const isOpen = expandedRawMatId === item.raw_mat_id
                    return (
                      <Fragment key={item.raw_mat_id}>
                        <TableRow className="cursor-pointer" onClick={() => toggleExpanded(item.raw_mat_id)}>
                          <TableCell>{item.item_name}</TableCell>
                          <TableCell className="text-[#3EA768] font-medium">
                            {item.stockIncrease ? `+${formatQty(item.stockIncrease)}` : '-'}
                          </TableCell>
                          <TableCell className="text-red-600 font-medium">
                            {item.stockDecrease ? `-${formatQty(item.stockDecrease)}` : '-'}
                          </TableCell>
                          <TableCell
                            className={`font-medium ${
                              item.stockIncrease - item.stockDecrease > 0
                                ? 'text-[#3EA768]'
                                : item.stockIncrease - item.stockDecrease < 0
                                  ? 'text-red-600'
                                  : ''
                            }`}
                          >
                            {item.stockIncrease - item.stockDecrease > 0 ? '+' : ''}
                            {formatQty(item.stockIncrease - item.stockDecrease)}
                          </TableCell>
                          <TableCell>
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={overviewColSpan} className="bg-muted/30 p-0">
                            <div
                              className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                              }`}
                            >
                              <div className="overflow-hidden">
                                <div className="pl-10">
                                  <Table className="text-xs table-fixed">
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-24 font-bold text-left">Business Date</TableHead>
                                        <TableHead className="w-32 font-bold text-left">Movement Type</TableHead>
                                        <TableHead className="w-16 font-bold text-left">Qty</TableHead>
                                        {!hideCost && <TableHead className="w-24 font-bold text-left">Price</TableHead>}
                                        <TableHead className="w-28 font-bold text-left">Purchase Order</TableHead>
                                        <TableHead className="w-28 font-bold text-left">Created By</TableHead>
                                        <TableHead className="font-bold text-left">Note</TableHead>
                                        <TableHead className="w-10" />
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {item.movements.map((movement) => (
                                        <TableRow
                                          key={movement.id}
                                          className={movement.qty < 0 ? 'bg-red-50' : 'bg-green-50'}
                                        >
                                          <TableCell className="align-top">{formatBusinessDate(movement.date)}</TableCell>
                                          <TableCell className="align-top">
                                            {MOVEMENT_LABEL[movement.movement_type] ?? movement.movement_type}
                                          </TableCell>
                                          <TableCell className={`align-top ${movement.qty < 0 ? 'text-red-600' : 'text-[#3EA768]'}`}>
                                            {movement.qty > 0 ? '+' : ''}
                                            {formatQty(movement.qty)}
                                          </TableCell>
                                          {!hideCost && (
                                            <TableCell className="align-top">
                                              {movement.price != null ? formatRupiah(movement.price) : '-'}
                                            </TableCell>
                                          )}
                                          <TableCell className="align-top">{movement.purchase_order_freetext ?? '-'}</TableCell>
                                          <TableCell className="align-top">{movement.created_by ?? '-'}</TableCell>
                                          <TableCell className="align-top whitespace-normal break-words">
                                            {movement.note ?? '-'}
                                          </TableCell>
                                          <TableCell className="align-top">
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon-sm"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => setEditingEntry(movement)}>
                                                  Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  variant="destructive"
                                                  onClick={() => setDeletingEntry(movement)}
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
                              </div>
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
        </TabsContent>

        <TabsContent value="daily" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search raw material name…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setDailyPage(1)
                }}
                className="w-80"
              />
              <FilterDialogButton />
              <div className="flex overflow-hidden rounded-md border border-input">
                <button
                  type="button"
                  onClick={() => {
                    setDirectionFilter((prev) => (prev === 'increase' ? null : 'increase'))
                    setDailyPage(1)
                  }}
                  className={`px-3 py-2 text-sm font-medium ${
                    directionFilter === 'increase'
                      ? 'bg-[#3EA768] text-white'
                      : 'bg-white text-muted-foreground hover:bg-accent'
                  }`}
                >
                  Stock Increase
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDirectionFilter((prev) => (prev === 'decrease' ? null : 'decrease'))
                    setDailyPage(1)
                  }}
                  className={`border-l border-input px-3 py-2 text-sm font-medium ${
                    directionFilter === 'decrease'
                      ? 'bg-red-600 text-white'
                      : 'bg-white text-muted-foreground hover:bg-accent'
                  }`}
                >
                  Stock Deduct
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="bg-[#3EA768] text-white hover:bg-[#357f52]" onClick={() => setView('add')}>
                + Add Raw Material
              </Button>
              <Button className="bg-red-600 text-white hover:bg-red-700" onClick={() => setDeductDialogOpen(true)}>
                Adjust Raw Material
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border bg-panel shadow-sm border-[oklch(0.84_0_0)] [&_tr]:border-[oklch(0.86_0_0)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Business Date</TableHead>
                  <TableHead className="font-bold">Raw Material</TableHead>
                  <TableHead className="font-bold">Movement Type</TableHead>
                  <TableHead className="font-bold">Qty</TableHead>
                  {!hideCost && <TableHead className="font-bold">Price</TableHead>}
                  <TableHead className="font-bold">Purchase Order</TableHead>
                  <TableHead className="font-bold">Created By</TableHead>
                  <TableHead className="font-bold">Note</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={dailyColSpan} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : dailyEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={dailyColSpan} className="text-center text-muted-foreground">
                      {search || rawMatFilter.size > 0 || createdByFilter.size > 0 || movementTypeFilter.size > 0 || directionFilter
                        ? 'No matching raw material movements.'
                        : 'No raw material movements yet.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  dailyPageEntries.map((entry) => (
                    <TableRow key={entry.id} className={entry.qty < 0 ? 'bg-red-50' : 'bg-green-50'}>
                      <TableCell>{formatBusinessDate(entry.date)}</TableCell>
                      <TableCell>{entry.item_name ?? '-'}</TableCell>
                      <TableCell>{MOVEMENT_LABEL[entry.movement_type] ?? entry.movement_type}</TableCell>
                      <TableCell className={entry.qty < 0 ? 'text-red-600' : 'text-[#3EA768]'}>
                        {entry.qty > 0 ? '+' : ''}
                        {formatQty(entry.qty)}
                      </TableCell>
                      {!hideCost && (
                        <TableCell>{entry.price != null ? formatRupiah(entry.price) : '-'}</TableCell>
                      )}
                      <TableCell>{entry.purchase_order_freetext ?? '-'}</TableCell>
                      <TableCell>{entry.created_by ?? '-'}</TableCell>
                      <TableCell className="max-w-xs whitespace-normal break-words">{entry.note ?? '-'}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon-sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingEntry(entry)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onClick={() => setDeletingEntry(entry)}>
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

          {dailyEntries.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                Showing {(dailyCurrentPage - 1) * DAILY_PAGE_SIZE + 1}–
                {Math.min(dailyCurrentPage * DAILY_PAGE_SIZE, dailyEntries.length)} of {dailyEntries.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={dailyCurrentPage <= 1}
                  onClick={() => setDailyPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {dailyCurrentPage} of {dailyTotalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={dailyCurrentPage >= dailyTotalPages}
                  onClick={() => setDailyPage((p) => Math.min(dailyTotalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {!hideCost && (
          <TabsContent value="price" className="space-y-4">
            <div className="overflow-x-auto rounded-md border bg-panel shadow-sm border-[oklch(0.84_0_0)] [&_tr]:border-[oklch(0.86_0_0)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">Purchase Order</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Items Missing Price</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : poGroupsMissingPrice.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Every purchase order item has a price.
                      </TableCell>
                    </TableRow>
                  ) : (
                    poGroupsMissingPrice.map(([key, group]) => {
                      const isOpen = expandedPoKey === key
                      const missingCount = group.movements.filter((m) => m.price == null).length
                      return (
                        <Fragment key={key}>
                          <TableRow
                            className="cursor-pointer"
                            onClick={() => setExpandedPoKey((prev) => (prev === key ? null : key))}
                          >
                            <TableCell>{group.poNumber}</TableCell>
                            <TableCell>{formatBusinessDate(group.date)}</TableCell>
                            <TableCell className="text-red-600 font-medium">
                              {missingCount} of {group.movements.length}
                            </TableCell>
                            <TableCell>
                              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell colSpan={4} className="bg-muted/30 p-0">
                              <div
                                className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                                  isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                                }`}
                              >
                                <div className="overflow-hidden">
                                  <div className="pl-10">
                                    <Table className="text-xs">
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="font-bold text-left">Raw Material</TableHead>
                                          <TableHead className="font-bold text-left">Qty</TableHead>
                                          <TableHead className="font-bold text-left">Price</TableHead>
                                          <TableHead className="font-bold text-left">Note</TableHead>
                                          <TableHead className="w-10" />
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {group.movements.map((movement) => (
                                          <TableRow key={movement.id}>
                                            <TableCell className="align-top">{movement.item_name ?? '-'}</TableCell>
                                            <TableCell className="align-top">{formatQty(movement.qty)}</TableCell>
                                            <TableCell className="align-top">
                                              {movement.price != null ? (
                                                formatRupiah(movement.price)
                                              ) : (
                                                <span className="font-medium text-red-600">Missing</span>
                                              )}
                                            </TableCell>
                                            <TableCell className="align-top max-w-xs whitespace-normal break-words">
                                              {movement.note ?? '-'}
                                            </TableCell>
                                            <TableCell className="align-top">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  setEditingPriceEntry(movement)
                                                }}
                                              >
                                                Edit
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
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
          </TabsContent>
        )}
      </Tabs>

      <RawMaterialMovementDialog open={deductDialogOpen} onOpenChange={setDeductDialogOpen} />
      <EditRawMaterialMovementDialog
        open={!!editingEntry}
        onOpenChange={(open) => !open && setEditingEntry(null)}
        entry={editingEntry}
      />
      <EditRawMaterialPriceDialog
        open={!!editingPriceEntry}
        onOpenChange={(open) => !open && setEditingPriceEntry(null)}
        entry={editingPriceEntry}
      />

      <AlertDialog open={!!deletingEntry} onOpenChange={(open) => !open && setDeletingEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete raw material movement?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this entry from the raw material ledger and recompute current stock.
              It stays on record for audit (who deleted it is saved), but won't show here again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
