import { ArrowLeft, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { listCustomers, type Customer } from '@/lib/customers'
import { formatRupiah, formatRupiahInput } from '@/lib/currency'
import { createNota, type NotaInput, type NotaListItem } from '@/lib/nota'
import { listProducts, type Product } from '@/lib/products'

function toNumber(formatted: string): number {
  return Number(formatted.replace(/\D/g, '')) || 0
}

interface ItemRow {
  key: string
  skuQuery: string
  skuId: number | null
  unit: string
  priceDisplay: string
  qty: string
  discountAmountDisplay: string
  discountPercent: string
  lastEdited: 'amount' | 'percent'
  showSuggestions: boolean
}

function newRow(): ItemRow {
  return {
    key: crypto.randomUUID(),
    skuQuery: '',
    skuId: null,
    unit: '',
    priceDisplay: '',
    qty: '',
    discountAmountDisplay: '',
    discountPercent: '',
    lastEdited: 'amount',
    showSuggestions: false,
  }
}

function subtotalOf(row: ItemRow): number {
  return toNumber(row.priceDisplay) * (Number(row.qty) || 0)
}

function recomputeFromAmount(row: ItemRow): ItemRow {
  const subtotal = subtotalOf(row)
  const amount = toNumber(row.discountAmountDisplay)
  const percent = subtotal > 0 ? Math.round((amount / subtotal) * 10000) / 100 : 0
  return { ...row, discountPercent: percent ? String(percent) : '' }
}

function recomputeFromPercent(row: ItemRow): ItemRow {
  const subtotal = subtotalOf(row)
  const percent = Number(row.discountPercent) || 0
  const amount = Math.round((subtotal * percent) / 100)
  return { ...row, discountAmountDisplay: amount ? formatRupiahInput(String(amount)) : '' }
}

function recompute(row: ItemRow): ItemRow {
  return row.lastEdited === 'amount' ? recomputeFromAmount(row) : recomputeFromPercent(row)
}

export function NotaCreatePanel({
  onCancel,
  onSaved,
}: {
  onCancel: () => void
  onSaved: (nota: NotaListItem) => void
}) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [notaDate, setNotaDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [customerQuery, setCustomerQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [items, setItems] = useState<ItemRow[]>([newRow()])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    listCustomers().then(setCustomers).catch(() => {})
    listProducts().then(setProducts).catch(() => {})
  }, [])

  function updateItem(key: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function handlePickProduct(key: string, product: Product) {
    updateItem(key, {
      skuQuery: product.sku_name,
      skuId: product.sku_id,
      unit: product.unit,
      priceDisplay:
        product.suggested_price != null ? formatRupiahInput(String(product.suggested_price)) : '',
      showSuggestions: false,
    })
  }

  const filteredCustomers = customerQuery
    ? customers.filter((c) => c.company_name.toLowerCase().includes(customerQuery.toLowerCase()))
    : customers

  const grandTotal = items.reduce((sum, row) => {
    return sum + subtotalOf(row) - toNumber(row.discountAmountDisplay)
  }, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!selectedCustomer) {
      setError('Pick a customer from the suggestions')
      return
    }
    if (!selectedCustomer.contact_id) {
      setError('This customer has no contact on file')
      return
    }
    if (items.length === 0 || items.some((row) => !row.skuQuery || !row.unit || !row.qty)) {
      setError('Every item needs a SKU name, unit and qty')
      return
    }

    const input: NotaInput = {
      nota_date: notaDate,
      customer_id: selectedCustomer.customer_id,
      contact_id: selectedCustomer.contact_id,
      items: items.map((row) => ({
        sku_id: row.skuId,
        sku_name: row.skuQuery,
        unit: row.unit,
        price: toNumber(row.priceDisplay),
        qty: Number(row.qty),
        discount_amount: toNumber(row.discountAmountDisplay),
        discount_percent: Number(row.discountPercent) || 0,
      })),
    }

    setLoading(true)
    try {
      const nota = await createNota(input)
      onSaved(nota)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create nota')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add Nota</h1>
          <p className="text-sm text-muted-foreground">Create a new nota for a customer.</p>
        </div>
      </div>

      <form id="nota-form" className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor="nota_date">Date</Label>
            <Input
              id="nota_date"
              type="date"
              value={notaDate}
              onChange={(e) => setNotaDate(e.target.value)}
              required
            />
          </div>
          <div className="relative space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <Input
              id="customer"
              value={customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value)
                setSelectedCustomer(null)
                setShowCustomerSuggestions(true)
              }}
              onFocus={() => setShowCustomerSuggestions(true)}
              onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 100)}
              placeholder="Type company name"
              autoComplete="off"
              required
            />
            {showCustomerSuggestions && filteredCustomers.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.customer_id}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      setSelectedCustomer(c)
                      setCustomerQuery(c.company_name)
                      setShowCustomerSuggestions(false)
                    }}
                  >
                    {c.company_name}
                  </button>
                ))}
              </div>
            )}
            {selectedCustomer && (
              <p className="text-xs text-muted-foreground">
                {selectedCustomer.contact_name ?? 'No contact'}
                {selectedCustomer.phone_number ? ` · ${selectedCustomer.phone_number}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Nota Item</Label>

          <div className="hidden gap-2 px-1 text-xs text-muted-foreground sm:grid sm:grid-cols-[minmax(0,2.5fr)_5rem_4.5rem_6.5rem_6.5rem_4.5rem_2.25rem]">
            <span>SKU name</span>
            <span>Unit</span>
            <span>Qty</span>
            <span>Price</span>
            <span>Disc. amount</span>
            <span>Disc. %</span>
            <span />
          </div>

          <div className="space-y-2">
            {items.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-1 gap-2 rounded-md border p-2 sm:grid-cols-[minmax(0,2.5fr)_5rem_4.5rem_6.5rem_6.5rem_4.5rem_2.25rem] sm:items-start sm:border-0 sm:p-0"
              >
                <div className="relative min-w-0">
                  <Input
                    value={row.skuQuery}
                    onChange={(e) => {
                      updateItem(row.key, {
                        skuQuery: e.target.value,
                        skuId: null,
                        showSuggestions: true,
                      })
                    }}
                    onFocus={() => updateItem(row.key, { showSuggestions: true })}
                    onBlur={() =>
                      setTimeout(() => updateItem(row.key, { showSuggestions: false }), 100)
                    }
                    placeholder="SKU name"
                    autoComplete="off"
                  />
                  {row.showSuggestions && row.skuQuery && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                      {products
                        .filter((p) => p.sku_name.toLowerCase().includes(row.skuQuery.toLowerCase()))
                        .map((p) => (
                          <button
                            key={p.sku_id}
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                            onClick={() => handlePickProduct(row.key, p)}
                          >
                            {p.sku_name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <Input
                  className="min-w-0"
                  value={row.unit}
                  onChange={(e) => updateItem(row.key, { unit: e.target.value })}
                  placeholder="Unit"
                />
                <Input
                  className="min-w-0"
                  inputMode="decimal"
                  value={row.qty}
                  onChange={(e) => updateItem(row.key, recompute({ ...row, qty: e.target.value }))}
                  placeholder="Qty"
                />
                <div className="relative min-w-0">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    className="min-w-0 pl-7"
                    inputMode="numeric"
                    value={row.priceDisplay}
                    onChange={(e) =>
                      updateItem(
                        row.key,
                        recompute({ ...row, priceDisplay: formatRupiahInput(e.target.value) }),
                      )
                    }
                    placeholder="Price"
                  />
                </div>
                <div className="relative min-w-0">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    className="min-w-0 pl-7"
                    inputMode="numeric"
                    value={row.discountAmountDisplay}
                    onChange={(e) =>
                      updateItem(
                        row.key,
                        recomputeFromAmount({
                          ...row,
                          discountAmountDisplay: formatRupiahInput(e.target.value),
                          lastEdited: 'amount',
                        }),
                      )
                    }
                    placeholder="0"
                  />
                </div>
                <div className="relative min-w-0">
                  <Input
                    className="min-w-0 pr-6"
                    inputMode="decimal"
                    value={row.discountPercent}
                    onChange={(e) =>
                      updateItem(
                        row.key,
                        recomputeFromPercent({
                          ...row,
                          discountPercent: e.target.value,
                          lastEdited: 'percent',
                        }),
                      )
                    }
                    placeholder="0"
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    %
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 justify-self-end sm:justify-self-auto"
                  disabled={items.length === 1}
                  onClick={() => setItems((prev) => prev.filter((r) => r.key !== row.key))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => [...prev, newRow()])}
          >
            + Add Item
          </Button>
        </div>

        <div className="flex justify-end text-sm font-medium">Total: {formatRupiah(grandTotal)}</div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  )
}
