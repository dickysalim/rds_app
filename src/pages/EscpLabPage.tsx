import { PrinterIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EscpContent } from '@/components/EscpContent'
import {
  ESCP_VARIANTS,
  ESCP_VARIANT_KEYS,
  printNotaEscp,
  printNotaEscpViaBrowser,
  type EscpVariant,
  type NotaDocType,
} from '@/lib/notaEscp'
import { SAMPLE_BUSINESS, SAMPLE_NOTA } from '@/lib/escpSample'

export function EscpLabPage() {
  const [open, setOpen] = useState(true)
  const [variant, setVariant] = useState<EscpVariant>('type1')
  const [docType, setDocType] = useState<NotaDocType>('nota_pembelian')
  const nota = SAMPLE_NOTA
  const effectiveBusiness = SAMPLE_BUSINESS

  async function handlePrint() {
    try {
      await printNotaEscp(nota, effectiveBusiness, undefined, docType, variant)
      toast.success(`Sent to printer (${ESCP_VARIANTS[variant].label})`)
    } catch {
      // QZ Tray not installed/running -- fall back to the browser's own print
      // dialog so Print still works on a plain PC.
      printNotaEscpViaBrowser(nota, effectiveBusiness, docType)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Button onClick={() => setOpen(true)}>Open Nota Preview</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[90vh] max-h-[90vh] max-w-6xl flex-col sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{nota.nota_number}</DialogTitle>
          </DialogHeader>
          {(
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex flex-col gap-1">
                <div className="flex gap-2">
                  {ESCP_VARIANT_KEYS.map((key) => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={variant === key ? 'default' : 'outline'}
                      onClick={() => setVariant(key)}
                    >
                      {ESCP_VARIANTS[key].label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{ESCP_VARIANTS[variant].description}</p>
              </div>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                >
                  <PrinterIcon />
                  Print {ESCP_VARIANTS[variant].label}
                </Button>
              </div>
              <EscpContent
                nota={nota}
                business={effectiveBusiness}
                docType={docType}
                className="min-h-0 flex-1"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
