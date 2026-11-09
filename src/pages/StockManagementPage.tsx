import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { Fragment, useState } from 'react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { StockMovementDialog } from '@/components/StockMovementDialog'
import { formatQty } from '@/lib/currency'
import { useStockLedgerQuery } from '@/lib/queries'

const MOVEMENT_LABEL: Record<string, string> = {
  stock_input: 'Stock In',
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

const ALL = 'all'

export function StockManagementPage() {
  const { data: entries = [], isLoading: loading } = useStockLedgerQuery()
  const [search, setSearch] = useState('')
  const [skuFilter, setSkuFilter] = useState<Set<number>>(new Set())
  const [skuSearch, setSkuSearch] = useState('')
  const [createdByFilter, setCreatedByFilter] = useState(ALL)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

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
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(skuId)) next.delete(skuId)
      else next.add(skuId)
      return next
    })
  }

  const periodEntries = entries.filter((entry) =>
    entry.date.startsWith(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`),
  )

  const skuOptions = Array.from(
    new Map(periodEntries.map((entry) => [entry.sku_id, entry.item_name ?? '-'])).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]))
  const createdByOptions = Array.from(
    new Set(periodEntries.map((entry) => entry.created_by).filter((v): v is string => !!v)),
  ).sort((a, b) => a.localeCompare(b))

  const monthEntries = periodEntries.filter(
    (entry) =>
      (skuFilter.size === 0 || skuFilter.has(entry.sku_id)) &&
      (createdByFilter === ALL || entry.created_by === createdByFilter),
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Stock Management</h1>

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
          <Popover onOpenChange={(open) => !open && setSkuSearch('')}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="w-56 justify-between bg-white font-normal">
                {skuFilter.size === 0
                  ? 'All SKUs'
                  : skuFilter.size === 1
                    ? (skuOptions.find(([id]) => skuFilter.has(id))?.[1] ?? '1 SKU')
                    : `${skuFilter.size} SKUs`}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72">
              <Input
                placeholder="Search SKU…"
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
                className="mb-2 bg-white"
                autoFocus
              />
              <div className="max-h-64 overflow-y-auto">
                {skuOptions
                  .filter(([, name]) => name.toLowerCase().includes(skuSearch.trim().toLowerCase()))
                  .map(([id, name]) => {
                    const checked = skuFilter.has(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() =>
                          setSkuFilter((prev) => {
                            const next = new Set(prev)
                            if (next.has(id)) next.delete(id)
                            else next.add(id)
                            return next
                          })
                        }
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
              {skuFilter.size > 0 && (
                <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setSkuFilter(new Set())}>
                  Clear ({skuFilter.size})
                </Button>
              )}
            </PopoverContent>
          </Popover>
          <Select value={createdByFilter} onValueChange={setCreatedByFilter}>
            <SelectTrigger className="w-44 bg-white">
              <SelectValue placeholder="Created By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Users</SelectItem>
              {createdByOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setDialogOpen(true)}>+ Add Stock Movement</Button>
      </div>

      <div className="overflow-x-auto rounded-md border bg-panel shadow-sm border-[oklch(0.84_0_0)] [&_tr]:border-[oklch(0.86_0_0)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item Name</TableHead>
              <TableHead>Stock Increase</TableHead>
              <TableHead>Stock Decrease</TableHead>
              <TableHead>Net Stock Change</TableHead>
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
                  {search || skuFilter.size > 0 || createdByFilter !== ALL ? 'No matching stock movements.' : `No stock movements for ${monthLabel}.`}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const isOpen = expanded.has(item.sku_id)
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
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/30 p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Business Date</TableHead>
                                <TableHead>Movement Type</TableHead>
                                <TableHead>Created By</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Invoice Number</TableHead>
                                <TableHead>Note</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {item.movements.map((movement) => (
                                <TableRow key={`${movement.kind}-${movement.id}`}>
                                  <TableCell>{formatBusinessDate(movement.date)}</TableCell>
                                  <TableCell>{MOVEMENT_LABEL[movement.movement_type] ?? movement.movement_type}</TableCell>
                                  <TableCell>{movement.created_by ?? '-'}</TableCell>
                                  <TableCell className={movement.qty < 0 ? 'text-red-600' : 'text-[#3EA768]'}>
                                    {movement.qty > 0 ? '+' : ''}
                                    {formatQty(movement.qty)}
                                  </TableCell>
                                  <TableCell>{movement.invoice_number ?? '-'}</TableCell>
                                  <TableCell>{movement.note ?? '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
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

      <StockMovementDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
