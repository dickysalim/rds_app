import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { RawMaterial } from '@/lib/rawMaterial'

// Same Popover+Input filter pattern as ProductCombobox, single-select.
export function RawMaterialCombobox({
  rawMaterials,
  value,
  onChange,
  placeholder = 'Select raw material',
}: {
  rawMaterials: RawMaterial[]
  value: number | null
  onChange: (rawMatId: number) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const selected = rawMaterials.find((m) => m.raw_mat_id === value)
  const filtered = rawMaterials.filter((m) =>
    m.raw_mat_sku_name.toLowerCase().includes(search.trim().toLowerCase()),
  )

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
          <span className={selected ? '' : 'text-muted-foreground'}>
            {selected ? selected.raw_mat_sku_name : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
        <Input
          placeholder="Search raw material…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 bg-white"
          autoFocus
        />
        <div className="max-h-64 overflow-y-auto">
          {filtered.map((m) => (
            <button
              key={m.raw_mat_id}
              type="button"
              onClick={() => {
                onChange(m.raw_mat_id)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {value === m.raw_mat_id && <Check className="h-4 w-4" />}
              </span>
              <span className="truncate">{m.raw_mat_sku_name}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No raw materials found.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
