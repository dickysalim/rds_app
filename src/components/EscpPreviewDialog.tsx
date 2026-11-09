import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EscpContent } from '@/components/EscpContent'
import type { Business } from '@/lib/business'
import type { NotaDetail } from '@/lib/nota'

export function EscpPreviewDialog({
  open,
  onOpenChange,
  nota,
  business,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nota: NotaDetail | null
  business: Business | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-[calc(100%-2rem)] flex-col sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Dot Matrix Preview</DialogTitle>
        </DialogHeader>
        <EscpContent nota={nota} business={business} />
      </DialogContent>
    </Dialog>
  )
}
