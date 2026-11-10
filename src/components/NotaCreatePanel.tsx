import { ArrowLeft, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Customer } from '@/lib/customers'
import { formatQty, formatRupiah, formatRupiahInput } from '@/lib/currency'
import { useNavGuard } from '@/lib/nav-guard'
import { UNITS, type NotaInput, type NotaListItem } from '@/lib/nota'
import type { Product } from '@/lib/products'
import {
  useBusinessAliasesQuery,
  useBusinessQuery,
  useCreateNotaMutation,
  useCustomersQuery,
  useProductsQuery,
  useUpdateCustomerMutation,
} from '@/lib/queries'

function toNumber(formatted: string): number {
  return Number(formatted.replace(/\D/g, '')) || 0
}

export const PAJAK_NAME_OPTIONS = ['PPN', 'PPh 21', 'PPh 22', 'PPh 23', 'PPh 4(2)', 'PPh 25', 'PPh 29']

// Usual rate for each tax name, prefilled on pick but still editable —
// PPh 25/29 have no standard flat rate (installment/annual settlement), so
// they're left blank for the user to fill in.
export const PAJAK_DEFAULT_PERCENTAGE: Record<string, string> = {
  PPN: '11',
  'PPh 21': '5',
  'PPh 22': '1.5',
  'PPh 23': '2',
  'PPh 4(2)': '10',
}

interface ItemRow {
  key: string
  skuQuery: string
  skuId: number | null
  unit: string
  priceDisplay: string
  qty: string
  showSuggestions: boolean
  highlightedIndex: number
}

function newRow(): ItemRow {
  return {
    key: crypto.randomUUID(),
    skuQuery: '',
    skuId: null,
    unit: '',
    priceDisplay: '',
    qty: '',
    showSuggestions: false,
    highlightedIndex: -1,
  }
}

function subtotalOf(row: ItemRow): number {
  return toNumber(row.priceDisplay) * (Number(row.qty) || 0)
}

export function NotaCreatePanel({
  onCancel,
  onSaved,
}: {
  onCancel: () => void
  onSaved: (nota: NotaListItem) => void
}) {
  const { data: customers = [] } = useCustomersQuery()
  const { data: products = [] } = useProductsQuery()
  const { data: business } = useBusinessQuery()
  const { data: businessAliases = [] } = useBusinessAliasesQuery()
  const createNotaMutation = useCreateNotaMutation()
  const updateCustomerMutation = useUpdateCustomerMutation()
  const [notaDate, setNotaDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [issuerBusinessId, setIssuerBusinessId] = useState<number | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isExistingCustomer, setIsExistingCustomer] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [companyHighlightedIndex, setCompanyHighlightedIndex] = useState(-1)
  const [notes, setNotes] = useState('')
  const [pajakName, setPajakName] = useState('')
  const [pajakPercentage, setPajakPercentage] = useState('')
  const [items, setItems] = useState<ItemRow[]>([newRow()])
  const skuInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function handleAddItem() {
    const row = newRow()
    setItems((prev) => [...prev, row])
    requestAnimationFrame(() => skuInputRefs.current[row.key]?.focus())
  }
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmBack, setConfirmBack] = useState(false)
  const pendingLeaveRef = useRef<(() => void) | null>(null)
  const { guardRef } = useNavGuard()

  useEffect(() => {
    guardRef.current = (proceed) => {
      pendingLeaveRef.current = proceed
      setConfirmBack(true)
    }
    return () => {
      guardRef.current = null
    }
  }, [guardRef])
  const [confirmSave, setConfirmSave] = useState(false)
  const [confirmUpdateCustomer, setConfirmUpdateCustomer] = useState(false)
  const [pendingNota, setPendingNota] = useState<NotaListItem | null>(null)

  useEffect(() => {
    setError(null)
  }, [notaDate, companyName, companyAddress, contactPerson, phoneNumber, items, pajakName, pajakPercentage])

  useEffect(() => {
    if (issuerBusinessId === null && business) setIssuerBusinessId(business.business_id)
  }, [business, issuerBusinessId])

  const businessOptions = [...(business ? [business] : []), ...businessAliases]

  function updateItem(key: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function handlePickProduct(key: string, product: Product) {
    setItems((prev) =>
      prev.map((row) =>
        row.key === key
          ? {
              ...row,
              skuQuery: product.sku_name,
              skuId: product.sku_id,
              unit: product.unit,
              priceDisplay:
                product.suggested_price != null
                  ? formatRupiahInput(String(product.suggested_price))
                  : '',
              showSuggestions: false,
              highlightedIndex: -1,
            }
          : row,
      ),
    )
  }

  function handlePickCompany(customer: Customer) {
    setCompanyName(customer.company_name)
    setCompanyAddress(customer.address ?? '')
    setContactPerson(customer.contact_person ?? '')
    setPhoneNumber(customer.phone_number ?? '')
    setIsExistingCustomer(true)
    setSelectedCustomer(customer)
    setShowCustomerSuggestions(false)
    setCompanyHighlightedIndex(-1)
  }

  const filteredCustomers = companyName
    ? customers.filter((c) => c.company_name.toLowerCase().includes(companyName.toLowerCase())).slice(0, 5)
    : customers.slice(0, 5)

  const grandTotal = items.reduce((sum, row) => sum + subtotalOf(row), 0)
  const anyExceedsStock = items.some(exceedsStock)

  function exceedsStock(row: ItemRow): boolean {
    if (row.skuId === null) return false
    const product = products.find((p) => p.sku_id === row.skuId)
    return product?.current_stock != null && Number(row.qty) > product.current_stock
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!companyName.trim()) {
      setError('Company name is required')
      return
    }
    if (items.length === 0 || items.some((row) => !row.skuQuery.trim() || !row.unit || !row.qty)) {
      setError('Every item needs a SKU name, unit and qty')
      return
    }
    if (items.some(exceedsStock)) {
      setError('An item quantity exceeds current stock')
      return
    }
    if (!!pajakName !== !!pajakPercentage) {
      setError('Pajak name and percentage must be filled together')
      return
    }

    setConfirmSave(true)
  }

  async function doSave() {
    setConfirmSave(false)
    setError(null)

    if (!companyName.trim()) {
      setError('Company name is required')
      return
    }
    if (items.length === 0 || items.some((row) => !row.skuQuery.trim() || !row.unit || !row.qty)) {
      setError('Every item needs a SKU name, unit and qty')
      return
    }
    if (items.some(exceedsStock)) {
      setError('An item quantity exceeds current stock')
      return
    }
    if (!!pajakName !== !!pajakPercentage) {
      setError('Pajak name and percentage must be filled together')
      return
    }

    const input: NotaInput = {
      nota_date: notaDate,
      company_name: companyName.trim(),
      company_address: companyAddress.trim() || null,
      contact_name: contactPerson.trim() || null,
      phone_number: phoneNumber.trim() || null,
      notes: notes.trim() || null,
      business_id: issuerBusinessId,
      pajak_name: pajakName || null,
      pajak_percentage: pajakPercentage ? Number(pajakPercentage) : null,
      items: items.map((row) => ({
        sku_id: row.skuId,
        sku_name: row.skuQuery.trim(),
        unit: row.unit,
        price: toNumber(row.priceDisplay),
        qty: Number(row.qty),
        discount_amount: 0,
        discount_percent: 0,
      })),
    }

    setLoading(true)
    try {
      const nota = await createNotaMutation.mutateAsync(input)
      const customerDataChanged =
        isExistingCustomer &&
        selectedCustomer !== null &&
        (contactPerson !== (selectedCustomer.contact_person ?? '') ||
          phoneNumber !== (selectedCustomer.phone_number ?? '') ||
          companyAddress !== (selectedCustomer.address ?? ''))

      if (customerDataChanged) {
        setPendingNota(nota)
        setConfirmUpdateCustomer(true)
      } else {
        onSaved(nota)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create nota')
    } finally {
      setLoading(false)
    }
  }

  async function applyCustomerUpdate(shouldUpdate: boolean) {
    setConfirmUpdateCustomer(false)
    if (shouldUpdate && selectedCustomer) {
      try {
        await updateCustomerMutation.mutateAsync({
          customerId: selectedCustomer.customer_id,
          input: {
            company_name: companyName.trim(),
            address: companyAddress.trim() || null,
            contact_person: contactPerson.trim(),
            phone_number: phoneNumber.trim(),
          },
        })
      } catch {
        // nota already saved; customer update failure is non-blocking
      }
    }
    if (pendingNota) onSaved(pendingNota)
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          pendingLeaveRef.current = onCancel
          setConfirmBack(true)
        }}
        className="-ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add Nota</h1>
          <p className="text-sm text-muted-foreground">Create a new nota for a customer.</p>
        </div>
        <Button type="submit" form="nota-form" size="lg" disabled={loading || anyExceedsStock}>
          {loading ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <form
        id="nota-form"
        className="space-y-10"
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') {
            e.preventDefault()
          }
        }}
      >
        <div className="flex w-full gap-x-8">
          <div className="grid flex-1 grid-cols-[9rem_1fr] items-center gap-x-8 gap-y-1.5">
            <Label htmlFor="nota_date" className="text-right">
              Date
            </Label>
            <Input
              id="nota_date"
              type="date"
              value={notaDate}
              onChange={(e) => setNotaDate(e.target.value)}
              required
            />

            <Label htmlFor="alias" className="text-right">
              Alias
            </Label>
            <Select
              value={issuerBusinessId != null ? String(issuerBusinessId) : undefined}
              onValueChange={(v) => setIssuerBusinessId(Number(v))}
            >
              <SelectTrigger id="alias" className="w-full">
                <SelectValue placeholder="Select company identity" />
              </SelectTrigger>
              <SelectContent>
                {businessOptions.map((b) => (
                  <SelectItem key={b.business_id} value={String(b.business_id)}>
                    {b.business_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Label htmlFor="notes" className="text-right">
              Notes
            </Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
            />

            <Label htmlFor="pajak_name" className="text-right">
              Pajak Name
            </Label>
            <Select
              value={pajakName || 'none'}
              onValueChange={(v) => {
                if (v === 'none') {
                  setPajakName('')
                  setPajakPercentage('')
                  return
                }
                setPajakName(v)
                setPajakPercentage(PAJAK_DEFAULT_PERCENTAGE[v] ?? '')
              }}
            >
              <SelectTrigger id="pajak_name" className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {PAJAK_NAME_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Label htmlFor="pajak_percentage" className="text-right">
              Pajak Percentage
            </Label>
            <div className="relative">
              <Input
                id="pajak_percentage"
                inputMode="decimal"
                className="pr-7"
                value={pajakPercentage}
                disabled={!pajakName}
                onChange={(e) => setPajakPercentage(e.target.value.replace(/[^\d.]/g, ''))}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
          </div>

          <div className="grid flex-[1.6] grid-cols-[9rem_1fr] items-center gap-x-8 gap-y-1.5">
            <Label htmlFor="company_name" className="text-right">
              Customer Name
            </Label>
            <div className="relative">
            <Input
              id="company_name"
              value={companyName}
              onChange={(e) => {
                const typed = e.target.value
                const exact = customers.find(
                  (c) => c.company_name.trim().toLowerCase() === typed.trim().toLowerCase(),
                )
                if (exact) {
                  handlePickCompany(exact)
                  return
                }
                setCompanyName(typed)
                setIsExistingCustomer(false)
                setShowCustomerSuggestions(true)
                setCompanyHighlightedIndex(-1)
              }}
              onFocus={() => setShowCustomerSuggestions(true)}
              onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 100)}
              onKeyDown={(e) => {
                if (!showCustomerSuggestions || filteredCustomers.length === 0) return
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setCompanyHighlightedIndex((i) => Math.min(i + 1, filteredCustomers.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setCompanyHighlightedIndex((i) => Math.max(i - 1, 0))
                } else if (e.key === 'Enter') {
                  if (companyHighlightedIndex >= 0) {
                    e.preventDefault()
                    handlePickCompany(filteredCustomers[companyHighlightedIndex])
                  }
                } else if (e.key === 'Escape') {
                  setShowCustomerSuggestions(false)
                }
              }}
              placeholder="Type or pick a customer name"
              autoComplete="off"
              required
            />
            {showCustomerSuggestions && companyName.trim() && filteredCustomers.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                {filteredCustomers.map((c, idx) => (
                  <button
                    key={c.customer_id}
                    type="button"
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-accent ${
                      idx === companyHighlightedIndex ? 'bg-accent' : ''
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setCompanyHighlightedIndex(idx)}
                    onClick={() => handlePickCompany(c)}
                  >
                    {c.company_name}
                  </button>
                ))}
              </div>
            )}
          </div>

            <Label htmlFor="contact_person" className="text-right">
              Contact Person
            </Label>
            <Input
              id="contact_person"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              disabled={isExistingCustomer}
              className="disabled:bg-[oklch(0.9_0_0)] disabled:opacity-100"
            />

            <Label htmlFor="phone_number" className="text-right">
              Phone Number
            </Label>
            <Input
              id="phone_number"
              type="tel"
              inputMode="numeric"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
              disabled={isExistingCustomer}
              className="disabled:bg-[oklch(0.9_0_0)] disabled:opacity-100"
            />

            <Label htmlFor="company_address" className="self-start pt-2 text-right">
              Address
            </Label>
            <Textarea
              id="company_address"
              className="min-h-[4.5rem] disabled:bg-[oklch(0.9_0_0)] disabled:opacity-100"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              disabled={isExistingCustomer}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="font-bold">Nota Item</Label>

          <div className="rounded-xl border border-[oklch(0.75_0_0)] bg-panel shadow-sm">
          <div className="hidden gap-2 rounded-t-xl border-b border-[oklch(0.75_0_0)] bg-panel px-3 pb-3 pt-2 text-xs font-semibold text-black sm:grid sm:grid-cols-[minmax(0,1.1fr)_7rem_5.5rem_10rem_10rem_2.25rem]">
            <span>SKU name</span>
            <span>Unit</span>
            <span>Qty</span>
            <span>Price</span>
            <span>Total Price</span>
            <span />
          </div>

          <div className="pt-2">
            {items.map((row) => {
              const usedSkuIds = new Set(
                items.filter((r) => r.key !== row.key && r.skuId !== null).map((r) => r.skuId),
              )
              const filteredProducts = products
                .filter(
                  (p) =>
                    p.sku_name.toLowerCase().includes(row.skuQuery.toLowerCase()) &&
                    !usedSkuIds.has(p.sku_id),
                )
                .slice(0, 5)
              const lockedBySku = row.skuId !== null
              const stockProduct = row.skuId !== null ? products.find((p) => p.sku_id === row.skuId) : undefined
              const currentStock = stockProduct?.current_stock ?? null
              const cellInputClass =
                'min-w-0 bg-white'
              return (
              <div
                key={row.key}
                className="grid grid-cols-1 bg-panel gap-2 p-2 sm:grid-cols-[minmax(0,1.1fr)_7rem_5.5rem_10rem_10rem_2.25rem] sm:items-start sm:px-3 sm:py-1.5"
              >
                <div className="relative min-w-0">
                  <Input
                    ref={(el) => {
                      skuInputRefs.current[row.key] = el
                    }}
                    className={cellInputClass}
                    value={row.skuQuery}
                    onChange={(e) => {
                      const typed = e.target.value
                      const exact = products.find(
                        (p) => p.sku_name.trim().toLowerCase() === typed.trim().toLowerCase(),
                      )
                      if (exact) {
                        handlePickProduct(row.key, exact)
                        return
                      }
                      updateItem(row.key, {
                        skuQuery: typed,
                        skuId: null,
                        showSuggestions: true,
                        highlightedIndex: -1,
                      })
                    }}
                    onFocus={() => updateItem(row.key, { showSuggestions: true })}
                    onBlur={() =>
                      setTimeout(() => updateItem(row.key, { showSuggestions: false }), 100)
                    }
                    onKeyDown={(e) => {
                      if (!row.showSuggestions || filteredProducts.length === 0) return
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        updateItem(row.key, {
                          highlightedIndex: Math.min(
                            row.highlightedIndex + 1,
                            filteredProducts.length - 1,
                          ),
                        })
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        updateItem(row.key, {
                          highlightedIndex: Math.max(row.highlightedIndex - 1, 0),
                        })
                      } else if (e.key === 'Enter') {
                        if (row.highlightedIndex >= 0) {
                          e.preventDefault()
                          handlePickProduct(row.key, filteredProducts[row.highlightedIndex])
                        }
                      } else if (e.key === 'Escape') {
                        updateItem(row.key, { showSuggestions: false })
                      }
                    }}
                    autoComplete="off"
                  />
                  {row.showSuggestions && row.skuQuery && filteredProducts.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                      {filteredProducts.map((p, idx) => (
                        <button
                          key={p.sku_id}
                          type="button"
                          className={`block w-full px-3 py-2 text-left text-sm hover:bg-accent ${
                            idx === row.highlightedIndex ? 'bg-accent' : ''
                          }`}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => updateItem(row.key, { highlightedIndex: idx })}
                          onClick={() => handlePickProduct(row.key, p)}
                        >
                          {p.sku_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Select
                  value={row.unit}
                  onValueChange={(value) => updateItem(row.key, { unit: value })}
                  disabled={lockedBySku}
                >
                  <SelectTrigger
                    className={`${cellInputClass} w-full disabled:bg-[oklch(0.9_0_0)] disabled:opacity-100`}
                  >
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {(row.unit && !(UNITS as readonly string[]).includes(row.unit)
                      ? [...UNITS, row.unit]
                      : UNITS
                    ).map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="min-w-0">
                  <Input
                    className={cellInputClass}
                    inputMode="numeric"
                    value={row.qty}
                    onChange={(e) => {
                      const qty = e.target.value.replace(/[^0-9.]/g, '')
                      updateItem(row.key, { qty })
                    }}
                  />
                  {currentStock != null && (
                    <p
                      className={`mt-0.5 whitespace-nowrap text-xs ${exceedsStock(row) ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
                    >
                      {exceedsStock(row)
                        ? `Exceeds stock (${formatQty(currentStock)} available)`
                        : `Stock: ${formatQty(currentStock)}`}
                    </p>
                  )}
                </div>
                <div className="relative min-w-0">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    className={`${cellInputClass} pl-7`}
                    inputMode="numeric"
                    value={row.priceDisplay}
                    onChange={(e) =>
                      updateItem(row.key, { priceDisplay: formatRupiahInput(e.target.value) })
                    }
                    tabIndex={lockedBySku ? -1 : undefined}
                  />
                </div>
                <div className="relative min-w-0">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    className={`${cellInputClass} pl-7`}
                    value={formatRupiahInput(String(subtotalOf(row)))}
                    disabled
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  tabIndex={-1}
                  className="h-9 w-9 shrink-0 justify-self-end sm:justify-self-auto"
                  disabled={items.length === 1}
                  onClick={() => setItems((prev) => prev.filter((r) => r.key !== row.key))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              )
            })}
          </div>
          <div className="rounded-b-xl border-t border-[oklch(0.75_0_0)] bg-panel p-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
            >
              + Add Item
            </Button>
          </div>
          </div>
        </div>

        <div className="flex justify-end text-sm font-medium">Total: {formatRupiah(grandTotal)}</div>

        {error && <p className="text-destructive text-sm">{error}</p>}
      </form>

      <div aria-hidden className="h-[50vh]" />

      <AlertDialog open={confirmBack} onOpenChange={setConfirmBack}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this nota?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll lose everything entered so far. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmBack(false)
                pendingLeaveRef.current?.()
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmSave} onOpenChange={setConfirmSave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save this nota?</AlertDialogTitle>
            <AlertDialogDescription>
              Once saved, this nota can't be edited again. Make sure everything is correct.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={doSave} disabled={loading}>
              {loading ? 'Saving…' : 'Save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmUpdateCustomer} onOpenChange={setConfirmUpdateCustomer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update customer data?</AlertDialogTitle>
            <AlertDialogDescription>
              You changed this customer's contact person, phone number, or address during this
              nota. Do you want to update the customer data itself?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => applyCustomerUpdate(false)}>No</AlertDialogCancel>
            <AlertDialogAction onClick={() => applyCustomerUpdate(true)}>Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
