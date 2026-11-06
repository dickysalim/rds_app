import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Customer } from '@/lib/customers'
import { useCreateCustomerMutation, useUpdateCustomerMutation } from '@/lib/queries'

export function CustomerDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
  onSaved: (customer: Customer) => void
}) {
  const [companyName, setCompanyName] = useState('')
  const [address, setAddress] = useState('')
  const [contactName, setContactName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const createMutation = useCreateCustomerMutation()
  const updateMutation = useUpdateCustomerMutation()
  const loading = createMutation.isPending || updateMutation.isPending

  useEffect(() => {
    if (open) {
      setCompanyName(customer?.company_name ?? '')
      setAddress(customer?.address ?? '')
      setContactName(customer?.contact_person ?? '')
      setPhoneNumber(customer?.phone_number ?? '')
      setError(null)
    }
  }, [open, customer])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const input = {
        company_name: companyName.trim(),
        address: address.trim() || null,
        contact_person: contactName.trim() || null,
        phone_number: phoneNumber.trim() || null,
      }
      const saved = customer
        ? await updateMutation.mutateAsync({ customerId: customer.customer_id, input })
        : await createMutation.mutateAsync(input)
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save customer')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          <DialogDescription>
            {customer
              ? 'Update this customer and its primary contact.'
              : 'Create a new customer with its primary contact.'}
          </DialogDescription>
        </DialogHeader>
        <form id="customer-form" className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name</Label>
            <Input
              id="company_name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              maxLength={80}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={150}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_name">Contact Person Name</Label>
            <Input
              id="contact_name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              maxLength={60}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone_number">Phone</Label>
            <Input
              id="phone_number"
              type="tel"
              value={phoneNumber}
              inputMode="numeric"
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
              maxLength={15}
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </form>
        <DialogFooter>
          <Button type="submit" form="customer-form" disabled={loading}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
