import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
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
import type { AppOutletContext } from '@/components/AppLayout'
import { CustomerDialog } from '@/components/CustomerDialog'
import { CustomerHistoryDialog } from '@/components/CustomerHistoryDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SortableTableHead } from '@/components/SortableTableHead'
import { hideFinancials } from '@/lib/access'
import { formatRupiah } from '@/lib/currency'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Customer } from '@/lib/customers'
import { useCustomersQuery, useDeleteCustomerMutation } from '@/lib/queries'
import { useSort } from '@/lib/useSort'

type CustomerSortKey =
  | 'customer_id'
  | 'company_name'
  | 'address'
  | 'contact_person'
  | 'phone_number'
  | 'total_profit'

export function CustomerPage() {
  const { user } = useOutletContext<AppOutletContext>()
  const hideCost = hideFinancials(user.role)
  const { data: customers = [], isLoading: loading } = useCustomersQuery()
  const deleteMutation = useDeleteCustomerMutation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null)
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)
  const [search, setSearch] = useState('')
  const { sortKey, sortDir, toggle, applySort } = useSort<Customer, CustomerSortKey>(
    'customer_id',
    'desc',
  )

  function handleSaved() {
    // Mutations already invalidate the shared customers query.
  }

  async function handleDelete() {
    if (!deletingCustomer) return
    await deleteMutation.mutateAsync(deletingCustomer.customer_id)
    setDeletingCustomer(null)
  }

  const filteredCustomers = applySort(
    customers.filter((c) => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return (
        c.company_name.toLowerCase().includes(q) ||
        (c.address ?? '').toLowerCase().includes(q) ||
        (c.contact_person ?? '').toLowerCase().includes(q) ||
        (c.phone_number ?? '').toLowerCase().includes(q)
      )
    }),
    (row, key) => (key === 'total_profit' ? row.total_revenue - row.total_cost : (row[key] ?? '')),
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Customer</h1>

      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Search customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-80"
        />
        <Button
          onClick={() => {
            setEditingCustomer(null)
            setDialogOpen(true)
          }}
        >
          + Add Customer
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border bg-panel shadow-sm border-[oklch(0.84_0_0)] [&_tr]:border-[oklch(0.86_0_0)]">
<Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead active={sortKey === 'customer_id'} dir={sortDir} onClick={() => toggle('customer_id')}>
              Cust. ID
            </SortableTableHead>
            <SortableTableHead active={sortKey === 'company_name'} dir={sortDir} onClick={() => toggle('company_name')}>
              Company Name
            </SortableTableHead>
            <SortableTableHead active={sortKey === 'address'} dir={sortDir} onClick={() => toggle('address')}>
              Address
            </SortableTableHead>
            <SortableTableHead
              active={sortKey === 'contact_person'}
              dir={sortDir}
              onClick={() => toggle('contact_person')}
            >
              Contact Person Name
            </SortableTableHead>
            <SortableTableHead active={sortKey === 'phone_number'} dir={sortDir} onClick={() => toggle('phone_number')}>
              Phone
            </SortableTableHead>
            {!hideCost && (
              <SortableTableHead
                active={sortKey === 'total_profit'}
                dir={sortDir}
                onClick={() => toggle('total_profit')}
                className="text-left"
              >
                Total Profit
              </SortableTableHead>
            )}
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={hideCost ? 6 : 7} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          ) : filteredCustomers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={hideCost ? 6 : 7} className="text-center text-muted-foreground">
                {search ? 'No matching customers.' : 'No customers yet.'}
              </TableCell>
            </TableRow>
          ) : (
            filteredCustomers.map((customer) => (
                <TableRow key={customer.customer_id}>
                  <TableCell>{String(customer.customer_id).padStart(3, '0')}</TableCell>
                  <TableCell>{customer.company_name}</TableCell>
                  <TableCell>{customer.address ?? '-'}</TableCell>
                  <TableCell>{customer.contact_person ?? '-'}</TableCell>
                  <TableCell>{customer.phone_number ?? '-'}</TableCell>
                  {!hideCost && (
                    <TableCell className="text-[#3EA768] font-medium">
                      {formatRupiah(customer.total_revenue - customer.total_cost)}
                    </TableCell>
                  )}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingCustomer(customer)
                            setDialogOpen(true)
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setHistoryCustomer(customer)}>
                          History
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeletingCustomer(customer)}
                        >
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

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customer={editingCustomer}
        onSaved={handleSaved}
      />

      <CustomerHistoryDialog
        open={!!historyCustomer}
        onOpenChange={(open) => !open && setHistoryCustomer(null)}
        customerId={historyCustomer?.customer_id ?? null}
        companyName={historyCustomer?.company_name ?? null}
      />

      <AlertDialog
        open={!!deletingCustomer}
        onOpenChange={(open) => !open && setDeletingCustomer(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{deletingCustomer?.company_name}" from the customer list. This
              cannot be undone.
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
