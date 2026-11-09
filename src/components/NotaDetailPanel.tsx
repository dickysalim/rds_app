import { Download, PrinterIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { EscpContent } from '@/components/EscpContent'
import { PAJAK_DEFAULT_PERCENTAGE, PAJAK_NAME_OPTIONS } from '@/components/NotaCreatePanel'
import { PdfPreviewFrame } from '@/components/PdfPreviewFrame'
import { downloadNotaEscp, printNotaEscp, type NotaDocType } from '@/lib/notaEscp'
import { previewNotaPdfUrl } from '@/lib/notaPdf'
import {
  useBusinessAliasesQuery,
  useBusinessQuery,
  useNotaDetailQuery,
  useUpdateNotaMutation,
} from '@/lib/queries'

export function NotaDetailPanel({ notaId, onBack }: { notaId: number; onBack: () => void }) {
  const { data: nota } = useNotaDetailQuery(notaId)
  const { data: business } = useBusinessQuery()
  const { data: businessAliases = [] } = useBusinessAliasesQuery()
  const updateNotaMutation = useUpdateNotaMutation()
  const [error, setError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const [docType, setDocType] = useState<NotaDocType>('nota_pembelian')
  const [issuerBusinessId, setIssuerBusinessId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [pajakName, setPajakName] = useState('')
  const [pajakPercent, setPajakPercent] = useState('')

  useEffect(() => {
    if (!nota) return
    setIssuerBusinessId(nota.business_id)
    setNotes(nota.notes ?? '')
    setPajakName(nota.pajak_name ?? '')
    setPajakPercent(nota.pajak_percentage != null ? String(nota.pajak_percentage) : '')
  }, [nota])

  useEffect(() => {
    if (nota && nota.business_id == null && business && issuerBusinessId == null) {
      setIssuerBusinessId(business.business_id)
    }
  }, [nota, business, issuerBusinessId])

  const businessOptions = [...(business ? [business] : []), ...businessAliases]
  const effectiveBusiness =
    (nota?.business_id != null
      ? businessOptions.find((b) => b.business_id === nota.business_id)
      : undefined) ?? business

  function saveField(input: {
    notes?: string | null
    business_id?: number | null
    pajak_name?: string | null
    pajak_percentage?: number | null
  }) {
    updateNotaMutation.mutate(
      {
        notaId,
        input: {
          notes,
          business_id: issuerBusinessId,
          pajak_name: pajakName || null,
          pajak_percentage: pajakPercent ? Number(pajakPercent) : null,
          ...input,
        },
      },
      { onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save') },
    )
  }

  useEffect(() => {
    if (!nota || business === undefined) return
    let cancelled = false
    if (!effectiveBusiness) {
      setError('Set up Business Settings first')
      return
    }
    previewNotaPdfUrl(nota, effectiveBusiness)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nota, business, effectiveBusiness])

  async function handlePrintEscp() {
    if (!nota || !effectiveBusiness) return
    try {
      await printNotaEscp(nota, effectiveBusiness, undefined, docType)
      toast.success('Sent to printer')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to print')
    }
  }

  function handleDownloadEscp() {
    if (!nota || !effectiveBusiness) return
    downloadNotaEscp(nota, effectiveBusiness, docType)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onBack()}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] max-w-6xl flex-col sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{nota?.nota_number ?? 'Nota'}</DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="py-8 text-center text-sm text-destructive">{error}</p>
        ) : (
          <div className="flex min-h-0 flex-1 gap-4">
            <Tabs defaultValue="escp" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="self-start">
                <TabsTrigger value="escp">Continuous Print</TabsTrigger>
                <TabsTrigger value="pdf">PDF (A4)</TabsTrigger>
              </TabsList>
              <TabsContent value="pdf" className="min-h-0 flex-1">
                {pdfUrl ? (
                  <PdfPreviewFrame title="Nota PDF" url={pdfUrl} frameClassName="w-full rounded-md border" />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Generating…</p>
                )}
              </TabsContent>
              <TabsContent value="escp" className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Select value={docType} onValueChange={(v) => setDocType(v as NotaDocType)}>
                    <SelectTrigger id="doc_type" className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nota_pembelian">Nota Pembelian</SelectItem>
                      <SelectItem value="surat_jalan">Surat Jalan</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePrintEscp}
                      disabled={!nota || !effectiveBusiness}
                    >
                      <PrinterIcon />
                      Print
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadEscp}
                      disabled={!nota || !effectiveBusiness}
                    >
                      <Download />
                      Download (.prn)
                    </Button>
                  </div>
                </div>
                <EscpContent
                  nota={nota ?? null}
                  business={effectiveBusiness ?? null}
                  docType={docType}
                  className="min-h-0 flex-1"
                />
              </TabsContent>
            </Tabs>
            <div className="flex w-80 flex-col gap-4 border-l pl-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="detail_alias">Alias</Label>
                <Select
                  value={issuerBusinessId != null ? String(issuerBusinessId) : undefined}
                  onValueChange={(v) => {
                    const businessId = Number(v)
                    setIssuerBusinessId(businessId)
                    saveField({ business_id: businessId })
                  }}
                >
                  <SelectTrigger id="detail_alias" className="w-full">
                    <SelectValue placeholder="Select company identity" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessOptions.map((b) => (
                      <SelectItem key={b.business_id} value={String(b.business_id)}>
                        {b.business_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="detail_notes">Notes</Label>
                <Textarea
                  id="detail_notes"
                  className="min-h-[6rem]"
                  value={notes}
                  maxLength={200}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => saveField({ notes: notes || null })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Pajak</Label>
                <Select
                  value={pajakName || 'none'}
                  onValueChange={(v) => {
                    if (v === 'none') {
                      setPajakName('')
                      setPajakPercent('')
                      saveField({ pajak_name: null, pajak_percentage: null })
                      return
                    }
                    const percent = PAJAK_DEFAULT_PERCENTAGE[v] ?? ''
                    setPajakName(v)
                    setPajakPercent(percent)
                    saveField({
                      pajak_name: v,
                      pajak_percentage: percent ? Number(percent) : null,
                    })
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Name" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {PAJAK_NAME_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Input
                    inputMode="decimal"
                    className="pr-7"
                    placeholder="Percentage"
                    value={pajakPercent}
                    disabled={!pajakName}
                    onChange={(e) => setPajakPercent(e.target.value.replace(/[^\d.]/g, ''))}
                    onBlur={() =>
                      saveField({ pajak_percentage: pajakPercent ? Number(pajakPercent) : null })
                    }
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={updateNotaMutation.isPending}
                onClick={() => saveField({})}
              >
                Save &amp; Refresh
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
