import type { jsPDF } from 'jspdf'
import { apiFetch } from '@/lib/api'
import type { Business } from '@/lib/business'
import { loadGrayscaleLogoDataUrl } from '@/lib/logoCache'
import type { NotaDetail } from '@/lib/nota'

// jsPDF + jspdf-autotable are a large dependency only needed once a PDF is
// actually generated — loaded lazily here instead of at module import time
// so pages that never touch PDFs don't ship it in their initial bundle.
type JsPDFCtor = typeof import('jspdf').jsPDF
type AutoTableFn = typeof import('jspdf-autotable').default

let jsPDFCtor: JsPDFCtor | null = null
let autoTableFn: AutoTableFn | null = null

async function loadPdfLibs(): Promise<{ jsPDF: JsPDFCtor; autoTable: AutoTableFn }> {
  if (!jsPDFCtor || !autoTableFn) {
    const [{ jsPDF }, autoTableModule] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ])
    jsPDFCtor = jsPDF
    autoTableFn = autoTableModule.default
  }
  return { jsPDF: jsPDFCtor, autoTable: autoTableFn }
}

// Epson LX-310 continuous tractor-feed paper: 9.5" wide (241.3mm), no fixed
// page length — the page grows to fit however many items the nota has.
const PAGE_WIDTH = 241.3
const MARGIN = 16
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN

function fmt(amount: number): string {
  return new Intl.NumberFormat('id-ID').format(Math.round(amount))
}

function formatDateLong(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const LOGO_SIZE = 28

function drawLetterhead(doc: jsPDF, business: Business, nota: NotaDetail, logo: string | null): number {
  const textStartX = logo ? MARGIN + LOGO_SIZE + 4 : MARGIN

  if (logo) {
    doc.addImage(logo, MARGIN, 14, LOGO_SIZE, LOGO_SIZE)
  }

  const nameMaxWidth = CONTENT_RIGHT - textStartX
  doc.setFont('helvetica', 'bold')
  let nameFontSize = 18
  doc.setFontSize(nameFontSize)
  while (nameFontSize > 10 && doc.getTextWidth(business.business_name) > nameMaxWidth) {
    nameFontSize -= 1
    doc.setFontSize(nameFontSize)
  }
  doc.text(business.business_name, textStartX, 21)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  let y = 27
  if (business.business_address) {
    doc.text(business.business_address, textStartX, y)
    y += 5
  }
  if (business.business_contact_person || business.business_contact_number) {
    const line = [business.business_contact_person, business.business_contact_number]
      .filter(Boolean)
      .join(' - ')
    doc.text(line, textStartX, y)
    y += 5
  }
  if (business.business_email) {
    doc.text(`Email: ${business.business_email}`, textStartX, y)
    y += 5
  }

  const logoBottom = logo ? 14 + LOGO_SIZE : 0
  const headerBottom = Math.max(y, logoBottom) + 3
  doc.setDrawColor(0)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, headerBottom, CONTENT_RIGHT, headerBottom)

  const topY = headerBottom + 7
  doc.setFontSize(10)

  // Right column: nota number + date, right-aligned.
  const metaLabelX = CONTENT_RIGHT - 75
  const metaColonX = metaLabelX + 28
  let ry = topY
  doc.setFont('helvetica', 'bold')
  doc.text('No. Nota', metaLabelX, ry)
  doc.text(':', metaColonX, ry)
  doc.setFont('helvetica', 'normal')
  doc.text(nota.nota_number, CONTENT_RIGHT, ry, { align: 'right' })
  ry += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Tanggal Nota', metaLabelX, ry)
  doc.text(':', metaColonX, ry)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDateLong(nota.nota_date), CONTENT_RIGHT, ry, { align: 'right' })

  // Left column: customer, on the same rows as the meta block.
  const customerMaxWidth = metaLabelX - MARGIN - 6
  let sy = topY
  doc.setFont('helvetica', 'bold')
  doc.text('Kepada Yth.', MARGIN, sy)
  sy += 5.5
  doc.setFont('helvetica', 'normal')
  doc.text(nota.customer_company_name_snapshot, MARGIN, sy, { maxWidth: customerMaxWidth })
  sy += 5.5
  if (nota.contact_name_snapshot) {
    doc.text(nota.contact_name_snapshot, MARGIN, sy, { maxWidth: customerMaxWidth })
    sy += 5.5
  }
  if (nota.customer_address_snapshot) {
    doc.text(nota.customer_address_snapshot, MARGIN, sy, { maxWidth: customerMaxWidth })
    sy += 5.5
  }

  const sectionBottom = Math.max(sy, ry + 5.5) + 2
  doc.line(MARGIN, sectionBottom, CONTENT_RIGHT, sectionBottom)

  return sectionBottom + 2
}

function renderNota(doc: jsPDF, nota: NotaDetail, business: Business, logo: string | null): number {
  const tableStartY = drawLetterhead(doc, business, nota, logo)

  autoTableFn!(doc, {
    startY: tableStartY,
    margin: { left: MARGIN, right: MARGIN },
    head: [['No.', 'Nama Item', 'Qty', 'Unit', 'Harga', 'Total']],
    body: nota.items.map((item, idx) => [
      String(idx + 1),
      item.item_name_snapshot,
      String(item.qty),
      item.unit_snapshot,
      fmt(item.price),
      fmt(item.total_price),
    ]),
    styles: { font: 'helvetica', fontSize: 11, cellPadding: 2, overflow: 'linebreak' },
    headStyles: {
      fillColor: false,
      textColor: 0,
      fontStyle: 'bold',
      lineWidth: { bottom: 0.4 },
      lineColor: 0,
      valign: 'middle',
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
    },
    bodyStyles: { lineWidth: 0 },
    alternateRowStyles: { fillColor: false },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 16, halign: 'right' },
      3: { cellWidth: 18 },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && [2, 4, 5].includes(data.column.index)) {
        data.cell.styles.halign = 'right'
      }
    },
  })

  let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  doc.setDrawColor(0)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, finalY, CONTENT_RIGHT, finalY)
  finalY += 7

  const labelX = 140
  const valueX = CONTENT_RIGHT
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('TOTAL', labelX, finalY)
  doc.text(fmt(nota.total_price), valueX, finalY, { align: 'right' })

  return finalY
}

export async function buildNotaPdf(nota: NotaDetail, business: Business): Promise<jsPDF> {
  const [{ jsPDF }, logo] = await Promise.all([
    loadPdfLibs(),
    business.business_logo_key ? loadGrayscaleLogoDataUrl() : Promise.resolve(null),
  ])

  // jsPDF flips y-coordinates using the page height at draw time, so the
  // final page height must be known before drawing. Measure on a generously
  // tall scratch page first, then redraw on a page sized to fit exactly.
  const scratch = new jsPDF({ unit: 'mm', format: [PAGE_WIDTH, 2000] })
  const measuredFinalY = renderNota(scratch, nota, business, logo)

  // jsPDF's default "portrait" orientation silently swaps width/height
  // whenever width > height — which happens for short nota, since the
  // paper is 241.3mm wide. Pick the orientation that matches our actual
  // dimensions so it's a no-op instead of scrambling the page.
  const finalHeight = measuredFinalY + 14
  const orientation = finalHeight >= PAGE_WIDTH ? 'p' : 'l'
  const doc = new jsPDF({ unit: 'mm', format: [PAGE_WIDTH, finalHeight], orientation })
  renderNota(doc, nota, business, logo)

  return doc
}

// Nota are immutable once created (only void changes them), so the rendered
// PDF never needs to change. Cache it twice: in-memory for this session (no
// network at all on repeat preview/download), and server-side in R2 (no
// regeneration cost on the next session or device) via GET/PUT /nota/:id/pdf.
const pdfBlobCache = new Map<number, Blob>()

async function fetchServerCachedPdf(notaId: number): Promise<Blob | null> {
  try {
    const res = await apiFetch(`/nota/${notaId}/pdf`)
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

function uploadPdfToServerCache(notaId: number, blob: Blob): void {
  apiFetch(`/nota/${notaId}/pdf`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: blob,
  }).catch(() => {})
}

export function invalidateNotaPdfCache(notaId: number): void {
  pdfBlobCache.delete(notaId)
}

// Call after anything that changes the PDF letterhead (logo, business
// details) — every nota cached client- or server-side has the old one baked
// in. Clears this tab's in-memory cache and tells the server to drop its R2
// pointers too (the next preview/download regenerates and re-uploads).
export function clearAllNotaPdfCaches(): void {
  pdfBlobCache.clear()
  apiFetch('/nota/pdf-cache', { method: 'DELETE' }).catch(() => {})
}

async function getNotaPdfBlob(nota: NotaDetail, business: Business): Promise<Blob> {
  const cached = pdfBlobCache.get(nota.nota_id)
  if (cached) return cached

  // Mock/dev-only nota (negative ids) never hit the server cache.
  const serverCached = nota.nota_id > 0 ? await fetchServerCachedPdf(nota.nota_id) : null
  if (serverCached) {
    pdfBlobCache.set(nota.nota_id, serverCached)
    return serverCached
  }

  const doc = await buildNotaPdf(nota, business)
  const blob = doc.output('blob') as Blob
  pdfBlobCache.set(nota.nota_id, blob)
  if (nota.nota_id > 0) uploadPdfToServerCache(nota.nota_id, blob)
  return blob
}

export async function downloadNotaPdf(nota: NotaDetail, business: Business): Promise<void> {
  const blob = await getNotaPdfBlob(nota, business)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nota.nota_number.replace(/\//g, '-')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export async function previewNotaPdfUrl(nota: NotaDetail, business: Business): Promise<string> {
  const blob = await getNotaPdfBlob(nota, business)
  return URL.createObjectURL(blob)
}
