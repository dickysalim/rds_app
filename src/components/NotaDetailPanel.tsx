import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { previewNotaPdfUrl } from '@/lib/notaPdf'
import { useBusinessQuery, useNotaDetailQuery } from '@/lib/queries'

export function NotaDetailPanel({ notaId, onBack }: { notaId: number; onBack: () => void }) {
  const { data: nota } = useNotaDetailQuery(notaId)
  const { data: business } = useBusinessQuery()
  const [error, setError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!nota || business === undefined) return
    let cancelled = false
    if (!business) {
      setError('Set up Business Settings first')
      return
    }
    previewNotaPdfUrl(nota, business)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        blobUrlRef.current = url
        setPdfUrl(url)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
  }, [nota, business])

  return (
    <Dialog open onOpenChange={(open) => !open && onBack()}>
      <DialogContent className="max-w-5xl sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{nota?.nota_number ?? 'Nota'}</DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="py-8 text-center text-sm text-destructive">{error}</p>
        ) : pdfUrl ? (
          <iframe title="Nota PDF" src={pdfUrl} className="h-[80vh] w-full rounded-md border" />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Generating…</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
