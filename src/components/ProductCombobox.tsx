import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Product } from '@/lib/products'

// Click to open the dropdown, type to filter it -- same Popover+Input
// filter pattern as the "All SKUs" filter on StockManagementPage, just
// single-select instead of multi.
export function ProductCombobox({
  products,
  value,
  onChange,
  placeholder = 'Select item',
}: {
  products: Product[]
  value: number | null
  onChange: (skuId: number) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const selected = products.find((p) => p.sku_id === value)
  const filtered = products.filter((p) => p.sku_name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between bg-white font-normal">
          <span className={selected ? '' : 'text-muted-foreground'}>{selected ? selected.sku_name : placeholder}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
        <Input
          placeholder="Search item…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 bg-white"
          autoFocus
        />
        <div className="max-h-64 overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.sku_id}
              type="button"
              onClick={() => {
                onChange(p.sku_id)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {value === p.sku_id && <Check className="h-4 w-4" />}
              </span>
              <span className="truncate">{p.sku_name}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">No items found.</p>}
        </div>
      </PopoverContent>
    </Popover>
  )
}
