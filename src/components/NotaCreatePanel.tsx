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
import { listCustomers, updateCustomer, type Customer } from '@/lib/customers'
import { formatRupiah, formatRupiahInput } from '@/lib/currency'
import { useNavGuard } from '@/lib/nav-guard'
import { createNota, UNITS, type NotaInput, type NotaListItem } from '@/lib/nota'
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
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [notaDate, setNotaDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [companyName, setCompanyName] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isExistingCustomer, setIsExistingCustomer] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [companyHighlightedIndex, setCompanyHighlightedIndex] = useState(-1)
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
    listCustomers().then(setCustomers).catch(() => {})
    listProducts().then(setProducts).catch(() => {})
  }, [])

  useEffect(() => {
    setError(null)
  }, [notaDate, companyName, companyAddress, contactPerson, phoneNumber, items])

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
    setContactPerson(customer.contact_name ?? '')
    setPhoneNumber(customer.phone_number ?? '')
    setIsExistingCustomer(true)
    setSelectedCustomer(customer)
    setShowCustomerSuggestions(false)
    setCompanyHighlightedIndex(-1)
  }

  const filteredCustomers = companyName
    ? customers.filter((c) => c.company_name.toLowerCase().includes(companyName.toLowerCase()))
    : customers

  const grandTotal = items.reduce((sum, row) => sum + subtotalOf(row), 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!companyName || !contactPerson || !phoneNumber) {
      setError('Company name, contact person and phone number are required')
      return
    }
    if (items.length === 0 || items.some((row) => !row.skuQuery || !row.unit || !row.qty)) {
      setError('Every item needs a SKU name, unit and qty')
      return
    }

    setConfirmSave(true)
  }

  async function doSave() {
    setConfirmSave(false)
    setError(null)

    if (!companyName || !contactPerson || !phoneNumber) {
      setError('Company name, contact person and phone number are required')
      return
    }
    if (items.length === 0 || items.some((row) => !row.skuQuery || !row.unit || !row.qty)) {
      setError('Every item needs a SKU name, unit and qty')
      return
    }

    const input: NotaInput = {
      nota_date: notaDate,
      company_name: companyName,
      company_address: companyAddress || null,
      contact_name: contactPerson,
      phone_number: phoneNumber,
      items: items.map((row) => ({
        sku_id: row.skuId,
        sku_name: row.skuQuery,
        unit: row.unit,
        price: toNumber(row.priceDisplay),
        qty: Number(row.qty),
        discount_amount: 0,
        discount_percent: 0,
      })),
    }

    setLoading(true)
    try {
      const nota = await createNota(input)
      const customerDataChanged =
        isExistingCustomer &&
        selectedCustomer !== null &&
        (contactPerson !== (selectedCustomer.contact_name ?? '') ||
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
        await updateCustomer(selectedCustomer.customer_id, {
          company_name: companyName,
          address: companyAddress || null,
          contact_name: contactPerson,
          phone_number: phoneNumber,
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
        <Button type="submit" form="nota-form" size="lg" disabled={loading}>
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
        <div className="grid w-full grid-cols-[9rem_1fr_9rem_1.6fr] items-center gap-x-8 gap-y-1.5">
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

          <Label htmlFor="company_name" className="text-right">
            Company Name
          </Label>
          <div className="relative">
            <Input
              id="company_name"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value)
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
              placeholder="Type or pick a company name"
              autoComplete="off"
              required
            />
            {showCustomerSuggestions && filteredCustomers.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
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
            tabIndex={isExistingCustomer ? -1 : undefined}
            required
          />
          <Label htmlFor="company_address" className="self-start pt-2 text-right">
            Address
          </Label>
          <Textarea
            id="company_address"
            className="row-span-2 min-h-[4.5rem]"
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
            tabIndex={isExistingCustomer ? -1 : undefined}
          />

          <Label htmlFor="phone_number" className="text-right">
            Phone Number
          </Label>
          <Input
            id="phone_number"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            tabIndex={isExistingCustomer ? -1 : undefined}
            required
          />
        </div>

        <div className="space-y-2">
          <Label className="font-bold">Nota Item</Label>

          <div className="rounded-md border">
          <div className="hidden gap-2 border-b bg-muted px-3 py-2 text-xs font-semibold text-black sm:grid sm:grid-cols-[minmax(0,1.1fr)_7rem_5.5rem_10rem_10rem_2.25rem]">
            <span>SKU name</span>
            <span>Unit</span>
            <span>Qty</span>
            <span>Price</span>
            <span>Total Price</span>
            <span />
          </div>

          <div>
            {items.map((row) => {
              const filteredProducts = products.filter((p) =>
                p.sku_name.toLowerCase().includes(row.skuQuery.toLowerCase()),
              )
              const lockedBySku = row.skuId !== null
              const cellInputClass =
                'min-w-0 rounded-none border-0 border-b bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-b-ring'
              return (
              <div
                key={row.key}
                className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-[minmax(0,1.1fr)_7rem_5.5rem_10rem_10rem_2.25rem] sm:items-start sm:px-3 sm:py-1"
              >
                <div className="relative min-w-0">
                  <Input
                    ref={(el) => {
                      skuInputRefs.current[row.key] = el
                    }}
                    className={cellInputClass}
                    value={row.skuQuery}
                    onChange={(e) => {
                      updateItem(row.key, {
                        skuQuery: e.target.value,
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
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
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
                >
                  <SelectTrigger
                    className={`${cellInputClass} w-full`}
                    tabIndex={lockedBySku ? -1 : undefined}
                  >
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className={cellInputClass}
                  inputMode="numeric"
                  value={row.qty}
                  onChange={(e) =>
                    updateItem(row.key, { qty: e.target.value.replace(/[^0-9.]/g, '') })
                  }
                />
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
          <div className="border-t p-2">
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
