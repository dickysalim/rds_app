import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getBusiness } from '@/lib/business'
import { getNota, type NotaDetail } from '@/lib/nota'
import { previewNotaPdfUrl } from '@/lib/notaPdf'

export function NotaDetailPanel({ notaId, onBack }: { notaId: number; onBack: () => void }) {
  const [nota, setNota] = useState<NotaDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    getNota(notaId)
      .then(setNota)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [notaId])

  useEffect(() => {
    if (!nota) return
    let cancelled = false
    getBusiness()
      .then((business) => {
        if (!business) throw new Error('Set up Business Settings first')
        return previewNotaPdfUrl(nota, business)
      })
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = url
        setPdfUrl(url)
      })
      .catch((err: Error) => setError(err.message))
    return () => {
      cancelled = true
    }
  }, [nota])

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="-ml-2 self-start"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <h1 className="text-2xl font-semibold tracking-tight">
        {nota ? nota.nota_number : 'Nota Detail'}
      </h1>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : nota ? (
        <div className="flex-1 overflow-hidden rounded-md border">
          {pdfUrl ? (
            <iframe title="Nota PDF" src={pdfUrl} className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Generating…
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
