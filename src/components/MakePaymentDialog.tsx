import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatRupiahInput } from '@/lib/currency'
import { createPayment, PAYMENT_METHODS, uploadPaymentEvidence, type Payment } from '@/lib/nota'

export function MakePaymentDialog({
  notaId,
  open,
  onClose,
  onCreated,
}: {
  notaId: number
  open: boolean
  onClose: () => void
  onCreated: (payment: Payment) => void
}) {
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [amountDisplay, setAmountDisplay] = useState('')
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function reset() {
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setAmountDisplay('')
    setMethod('')
    setReference('')
    setEvidenceFile(null)
    setError(null)
    setSaving(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountNum = Number(amountDisplay.replace(/\D/g, ''))
    if (!amountNum || amountNum <= 0) {
      setError('Amount must be greater than 0')
      return
    }
    if (!method) {
      setError('Payment method is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payment = await createPayment(notaId, {
        payment_date: paymentDate,
        amount: amountNum,
        method,
        reference: reference || null,
      })
      if (evidenceFile) {
        await uploadPaymentEvidence(notaId, payment.payment_id, evidenceFile).catch(() => {})
      }
      reset()
      onClose()
      onCreated(payment)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Make Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label htmlFor="payment_date">Date</Label>
              <Input
                id="payment_date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="payment_amount">Amount</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  Rp
                </span>
                <Input
                  id="payment_amount"
                  inputMode="numeric"
                  className="pl-8"
                  value={amountDisplay}
                  onChange={(e) => setAmountDisplay(formatRupiahInput(e.target.value))}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="payment_method">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="payment_method" className="w-full">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="payment_reference">Reference (optional)</Label>
              <Input
                id="payment_reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="payment_evidence">Upload Evidence (optional)</Label>
              <Input
                id="payment_evidence"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
