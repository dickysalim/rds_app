import { useState } from 'react'
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
import { uploadPaymentEvidence } from '@/lib/nota'

export function UploadEvidenceDialog({
  notaId,
  paymentId,
  open,
  onClose,
  onUploaded,
}: {
  notaId: number
  paymentId: number
  open: boolean
  onClose: () => void
  onUploaded: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function reset() {
    setFile(null)
    setError(null)
    setSaving(false)
  }

  async function handleUpload() {
    if (!file) return
    setSaving(true)
    setError(null)
    try {
      await uploadPaymentEvidence(notaId, paymentId, file)
      onUploaded()
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload evidence')
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
        <DialogHeader>
          <DialogTitle>Upload Evidence</DialogTitle>
          <DialogDescription>Optional. Attach a receipt, screenshot, or proof of payment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Skip
          </Button>
          <Button type="button" onClick={handleUpload} disabled={!file || saving}>
            {saving ? 'Uploading…' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
