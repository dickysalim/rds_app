import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
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
import { CustomerDialog } from '@/components/CustomerDialog'
import { CustomerHistoryDialog } from '@/components/CustomerHistoryDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

export function CustomerPage() {
  const { data: customers = [], isLoading: loading } = useCustomersQuery()
  const deleteMutation = useDeleteCustomerMutation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null)
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)
  const [search, setSearch] = useState('')

  function handleSaved() {
    // Mutations already invalidate the shared customers query.
  }

  async function handleDelete() {
    if (!deletingCustomer) return
    await deleteMutation.mutateAsync(deletingCustomer.customer_id)
    setDeletingCustomer(null)
  }

  const filteredCustomers = customers.filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      c.company_name.toLowerCase().includes(q) ||
      (c.address ?? '').toLowerCase().includes(q) ||
      (c.contact_person ?? '').toLowerCase().includes(q) ||
      (c.phone_number ?? '').toLowerCase().includes(q)
    )
  })

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
            <TableHead>Cust. ID</TableHead>
            <TableHead>Company Name</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Contact Person Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          ) : filteredCustomers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                {search ? 'No matching customers.' : 'No customers yet.'}
              </TableCell>
            </TableRow>
          ) : (
            filteredCustomers
              .slice()
              .sort((a, b) => b.customer_id - a.customer_id)
              .map((customer) => (
                <TableRow key={customer.customer_id}>
                  <TableCell>{String(customer.customer_id).padStart(3, '0')}</TableCell>
                  <TableCell>{customer.company_name}</TableCell>
                  <TableCell>{customer.address ?? '-'}</TableCell>
                  <TableCell>{customer.contact_person ?? '-'}</TableCell>
                  <TableCell>{customer.phone_number ?? '-'}</TableCell>
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
