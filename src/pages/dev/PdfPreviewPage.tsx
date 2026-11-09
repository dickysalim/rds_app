import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getBusiness, type Business } from '@/lib/business'
import { getNota, listNota, type NotaDetail, type NotaListItem } from '@/lib/nota'
import { invalidateNotaPdfCache, previewNotaPdfUrl } from '@/lib/notaPdf'

const MOCK_SKUS = [
  { name: 'Mika Kopling KPH', unit: 'pcs', qty: 1000, price: 485 },
  { name: 'Mika Seal Magnet', unit: 'pcs', qty: 5000, price: 135 },
  { name: 'Mika Bearing 6300', unit: 'pcs', qty: 500, price: 110 },
  { name: 'Plastik Wrap Pallet', unit: 'roll', qty: 12, price: 85000 },
  { name: 'Kantong Plastik Besar', unit: 'pack', qty: 40, price: 32000 },
  { name: 'Mika Blister A4', unit: 'pack', qty: 3, price: 3000000 },
  { name: 'Lakban Bening 2 inch', unit: 'roll', qty: 60, price: 9500 },
  { name: 'Bubble Wrap 1.25m', unit: 'roll', qty: 8, price: 210000 },
  { name: 'Mika Seal Gearbox', unit: 'pcs', qty: 2500, price: 95 },
  { name: 'Plastik Vacuum 30cm', unit: 'roll', qty: 15, price: 65000 },
  { name: 'Mika Ring Piston', unit: 'pcs', qty: 1800, price: 220 },
  { name: 'Karton Box Medium', unit: 'pcs', qty: 25, price: 12500 },
]

const MOCK_NOTA: NotaDetail = {
  nota_id: -1,
  nota_number: 'MOCK/0000/0-0/00',
  nota_date: new Date().toISOString().slice(0, 10),
  customer_company_name_snapshot: 'PT Contoh Pelanggan Sejahtera',
  customer_address_snapshot: 'Jl. Raya Industri No. 88, Kawasan Industri, Cikarang, Jawa Barat',
  contact_name_snapshot: 'Andi Wijaya',
  contact_phone_number_snapshot: '081234567890',
  total_price: 0,
  paid_amount: 0,
  status: 'unpaid',
  notes: null,
  business_id: null,
  pajak_name: null,
  pajak_percentage: null,
  items: MOCK_SKUS.map((sku, idx) => {
    const totalPrice = sku.qty * sku.price
    return {
      nota_item_id: -(idx + 1),
      item_name_snapshot: sku.name,
      unit_snapshot: sku.unit,
      qty: sku.qty,
      price: sku.price,
      discount_amount: 0,
      discount_percent: 0,
      total_price: totalPrice,
      cost_price_snapshot: null,
    }
  }),
}
MOCK_NOTA.total_price = MOCK_NOTA.items.reduce((sum, item) => sum + item.total_price, 0)

const MOCK_OPTION_ID = -1

export function PdfPreviewPage() {
  const [notaList, setNotaList] = useState<NotaListItem[]>([])
  const [selectedNotaId, setSelectedNotaId] = useState<number | null>(MOCK_OPTION_ID)
  const [business, setBusiness] = useState<Business | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    listNota().then(({ nota: rows }) => setNotaList(rows))
    getBusiness().then(setBusiness)
  }, [])

  async function regenerate() {
    if (selectedNotaId === null || !business) return
    setGenerating(true)
    setError(null)
    try {
      const nota = selectedNotaId === MOCK_OPTION_ID ? MOCK_NOTA : await getNota(selectedNotaId)
      // Dev harness always wants the latest code, never a cached blob.
      invalidateNotaPdfCache(nota.nota_id)
      const url = await previewNotaPdfUrl(nota, business)
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = url
      setPdfUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    if (selectedNotaId !== null && business) regenerate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNotaId, business])

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nota PDF Preview</h1>
          <p className="text-sm text-muted-foreground">
            Dev-only. Edit src/lib/notaPdf.ts and click Regenerate to see the change.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedNotaId ? String(selectedNotaId) : undefined}
            onValueChange={(v) => setSelectedNotaId(Number(v))}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Pick a nota" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={String(MOCK_OPTION_ID)}>
                Mock — {MOCK_NOTA.items.length} items
              </SelectItem>
              {notaList.map((n) => (
                <SelectItem key={n.nota_id} value={String(n.nota_id)}>
                  {n.nota_number} — {n.customer_company_name_snapshot}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={regenerate} disabled={generating}>
            {generating ? 'Generating…' : 'Regenerate'}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex-1 overflow-hidden rounded-md border">
        {pdfUrl ? (
          <iframe title="Nota PDF preview" src={pdfUrl} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {generating ? 'Generating…' : 'Pick a nota to preview'}
          </div>
        )}
      </div>
    </div>
  )
}
