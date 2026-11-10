import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ListFilter, MoreHorizontal } from 'lucide-react'
import { Fragment, useState } from 'react'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdjustStockDialog } from '@/components/AdjustStockDialog'
import { EditStockMovementDialog } from '@/components/EditStockMovementDialog'
import { StockMovementDialog } from '@/components/StockMovementDialog'
import { formatQty } from '@/lib/currency'
import { useDeleteStockMovementMutation, useStockLedgerQuery } from '@/lib/queries'
import type { StockLedgerEntry } from '@/lib/stockLedger'

const MOVEMENT_LABEL: Record<string, string> = {
  production_in: 'Production In',
  shipment_return: 'Shipment Return',
  stock_out: 'Stock Out',
  stock_defect: 'Stock Defect',
  stock_loss: 'Stock Loss',
  adjust_up: 'Adjust Up',
  adjust_down: 'Adjust Down',
  sale: 'Sales',
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })

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

export function StockManagementPage() {
  const { data: entries = [], isLoading: loading } = useStockLedgerQuery()
  const [search, setSearch] = useState('')
  const [skuFilter, setSkuFilter] = useState<Set<string>>(new Set())
  const [createdByFilter, setCreatedByFilter] = useState<Set<string>>(new Set())
  const [movementTypeFilter, setMovementTypeFilter] = useState<Set<string>>(new Set())
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [deductDialogOpen, setDeductDialogOpen] = useState(false)
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())
  const [directionFilter, setDirectionFilter] = useState<'increase' | 'decrease' | null>(null)
  const [dailyPage, setDailyPage] = useState(1)
  const [expandedSkuId, setExpandedSkuId] = useState<number | null>(null)
  const [editingEntry, setEditingEntry] = useState<StockLedgerEntry | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<StockLedgerEntry | null>(null)
  const deleteMutation = useDeleteStockMovementMutation()

  async function handleDelete() {
    if (!deletingEntry) return
    await deleteMutation.mutateAsync(deletingEntry.id)
    setDeletingEntry(null)
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

  function toggleExpanded(skuId: number) {
    setExpandedSkuId((prev) => (prev === skuId ? null : skuId))
  }

  const periodEntries = entries.filter((entry) =>
    entry.date.startsWith(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`),
  )

  const skuOptions = Array.from(
    new Map(entries.map((entry) => [entry.sku_id, entry.item_name ?? '-'])).entries(),
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

  const totalFilterCount = skuFilter.size + createdByFilter.size + movementTypeFilter.size

  const monthEntries = periodEntries.filter(
    (entry) =>
      (skuFilter.size === 0 || skuFilter.has(String(entry.sku_id))) &&
      (createdByFilter.size === 0 || (entry.created_by != null && createdByFilter.has(entry.created_by))) &&
      (movementTypeFilter.size === 0 || movementTypeFilter.has(entry.movement_type)),
  )

  const itemMap = new Map<
    number,
    { sku_id: number; item_name: string; stockIncrease: number; stockDecrease: number; movements: typeof entries }
  >()
  for (const entry of monthEntries) {
    let item = itemMap.get(entry.sku_id)
    if (!item) {
      item = { sku_id: entry.sku_id, item_name: entry.item_name ?? '-', stockIncrease: 0, stockDecrease: 0, movements: [] }
      itemMap.set(entry.sku_id, item)
    }
    if (entry.qty > 0) item.stockIncrease += entry.qty
    else item.stockDecrease += Math.abs(entry.qty)
    item.movements.push(entry)
  }

  const items = Array.from(itemMap.values())
    .filter((item) => item.item_name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.item_name.localeCompare(b.item_name))

  const DAILY_PAGE_SIZE = 50
  const dailyEntries = entries
    .filter(
      (entry) =>
        (skuFilter.size === 0 || skuFilter.has(String(entry.sku_id))) &&
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
            <DialogTitle>Filter Stock Movements</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4">
            <FilterSection
              label="SKU"
              options={skuOptions.map(([id, name]): [string, string] => [String(id), name])}
              selected={skuFilter}
              onToggle={(id) =>
                setSkuFilter((prev) => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }
              onClear={() => setSkuFilter(new Set())}
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
                  setSkuFilter(new Set())
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Stock Management</h1>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Monthly Overview</TabsTrigger>
          <TabsTrigger value="daily">Daily Movement</TabsTrigger>
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
            placeholder="Search item name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-80"
          />
          <FilterDialogButton />
        </div>
        <div className="flex gap-2">
          <Button
            className="bg-[#3EA768] text-white hover:bg-[#357f52]"
            onClick={() => setAddDialogOpen(true)}
          >
            + Add Product
          </Button>
          <Button className="bg-red-600 text-white hover:bg-red-700" onClick={() => setDeductDialogOpen(true)}>
            - Deduct Product
          </Button>
          <Button onClick={() => setAdjustDialogOpen(true)}>
            Adjust Product
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border bg-panel shadow-sm border-[oklch(0.84_0_0)] [&_tr]:border-[oklch(0.86_0_0)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-bold">Item Name</TableHead>
              <TableHead className="font-bold">Stock Increase</TableHead>
              <TableHead className="font-bold">Stock Decrease</TableHead>
              <TableHead className="font-bold">Net Stock Change</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {search || skuFilter.size > 0 || createdByFilter.size > 0 || movementTypeFilter.size > 0 ? 'No matching stock movements.' : `No stock movements for ${monthLabel}.`}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const isOpen = expandedSkuId === item.sku_id
                return (
                  <Fragment key={item.sku_id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => toggleExpanded(item.sku_id)}
                    >
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
                      <TableCell colSpan={5} className="bg-muted/30 p-0">
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
                                    <TableHead className="font-bold text-left">Business Date</TableHead>
                                    <TableHead className="font-bold text-left">Movement Type</TableHead>
                                    <TableHead className="font-bold text-left">Qty</TableHead>
                                    <TableHead className="font-bold text-left">Created By</TableHead>
                                    <TableHead className="font-bold text-left">Note</TableHead>
                                    <TableHead className="w-10" />
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                              {item.movements.map((movement) => (
                                <TableRow
                                  key={`${movement.kind}-${movement.id}`}
                                  className={movement.qty < 0 ? 'bg-red-50' : 'bg-green-50'}
                                >
                                  <TableCell className="align-top">{formatBusinessDate(movement.date)}</TableCell>
                                  <TableCell className="align-top">{MOVEMENT_LABEL[movement.movement_type] ?? movement.movement_type}</TableCell>
                                  <TableCell className={`align-top ${movement.qty < 0 ? 'text-red-600' : 'text-[#3EA768]'}`}>
                                    {movement.qty > 0 ? '+' : ''}
                                    {formatQty(movement.qty)}
                                  </TableCell>
                                  <TableCell className="align-top">{movement.created_by ?? '-'}</TableCell>
                                  <TableCell className="align-top max-w-xs whitespace-normal break-words">{movement.note ?? '-'}</TableCell>
                                  <TableCell className="align-top">
                                    {movement.kind === 'ledger' && (
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
                                    )}
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
            placeholder="Search item name…"
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
          <Button
            className="bg-[#3EA768] text-white hover:bg-[#357f52]"
            onClick={() => setAddDialogOpen(true)}
          >
            + Add Product
          </Button>
          <Button className="bg-red-600 text-white hover:bg-red-700" onClick={() => setDeductDialogOpen(true)}>
            - Deduct Product
          </Button>
          <Button onClick={() => setAdjustDialogOpen(true)}>
            Adjust Product
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border bg-panel shadow-sm border-[oklch(0.84_0_0)] [&_tr]:border-[oklch(0.86_0_0)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-bold">Business Date</TableHead>
              <TableHead className="font-bold">Item Name</TableHead>
              <TableHead className="font-bold">Movement Type</TableHead>
              <TableHead className="font-bold">Qty</TableHead>
              <TableHead className="font-bold">Created By</TableHead>
              <TableHead className="font-bold">Note</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : dailyEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {search || skuFilter.size > 0 || createdByFilter.size > 0 || movementTypeFilter.size > 0 || directionFilter
                    ? 'No matching stock movements.'
                    : 'No stock movements.'}
                </TableCell>
              </TableRow>
            ) : (
              dailyPageEntries.map((movement) => (
                <TableRow
                  key={`${movement.kind}-${movement.id}`}
                  className={movement.qty < 0 ? 'bg-red-50' : 'bg-green-50'}
                >
                  <TableCell className="align-top">{formatBusinessDate(movement.date)}</TableCell>
                  <TableCell className="align-top">{movement.item_name ?? '-'}</TableCell>
                  <TableCell className="align-top">{MOVEMENT_LABEL[movement.movement_type] ?? movement.movement_type}</TableCell>
                  <TableCell className={`align-top ${movement.qty < 0 ? 'text-red-600' : 'text-[#3EA768]'}`}>
                    {movement.qty > 0 ? '+' : ''}
                    {formatQty(movement.qty)}
                  </TableCell>
                  <TableCell className="align-top">{movement.created_by ?? '-'}</TableCell>
                  <TableCell className="align-top max-w-xs whitespace-normal break-words">{movement.note ?? '-'}</TableCell>
                  <TableCell className="align-top">
                    {movement.kind === 'ledger' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon-sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingEntry(movement)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setDeletingEntry(movement)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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
      </Tabs>

      <StockMovementDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} mode="add" />
      <StockMovementDialog open={deductDialogOpen} onOpenChange={setDeductDialogOpen} mode="deduct" />
      <AdjustStockDialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen} />
      <EditStockMovementDialog
        open={!!editingEntry}
        onOpenChange={(open) => !open && setEditingEntry(null)}
        entry={editingEntry}
      />

      <AlertDialog open={!!deletingEntry} onOpenChange={(open) => !open && setDeletingEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stock movement?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this entry from the stock ledger and recompute current stock. It stays on
              record for audit (who deleted it is saved), but won't show here again.
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
