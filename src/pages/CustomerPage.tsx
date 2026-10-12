import { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listCustomers, type Customer } from '@/lib/customers'

export function CustomerPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listCustomers()
      .then(setCustomers)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Customer</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company Name</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Primary Contact</TableHead>
            <TableHead>Phone</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          ) : customers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No customers yet.
              </TableCell>
            </TableRow>
          ) : (
            customers.map((customer) => (
              <TableRow key={customer.customer_id}>
                <TableCell>{customer.company_name}</TableCell>
                <TableCell>{customer.address ?? '-'}</TableCell>
                <TableCell>{customer.contact_name ?? '-'}</TableCell>
                <TableCell>{customer.phone_number ?? '-'}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
