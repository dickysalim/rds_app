import type { jsPDF } from 'jspdf'
import type { Business } from '@/lib/business'
import type { Customer } from '@/lib/customers'
import { loadColorLogoDataUrl } from '@/lib/logoCache'
import { totalBillOf, type NotaListItem } from '@/lib/nota'

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

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 16
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN

function fmt(amount: number): string {
  return new Intl.NumberFormat('id-ID').format(Math.round(amount))
}

export function billNumber(customer: Customer, year: number, month: number): string {
  const yy = String(year).slice(-2)
  const mm = String(month).padStart(2, '0')
  return `BIL/${yy}${mm}/${customer.customer_id}`
}

const LOGO_SIZE = 28

function drawLetterhead(
  doc: jsPDF,
  business: Business,
  customer: Customer,
  billNo: string,
  year: number,
  month: number,
  logo: string | null,
): number {
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

  // Right column: bill number + date, right-aligned.
  const metaLabelX = CONTENT_RIGHT - 75
  const metaColonX = metaLabelX + 28
  let ry = topY
  doc.setFont('helvetica', 'bold')
  doc.text('No. Tagihan', metaLabelX, ry)
  doc.text(':', metaColonX, ry)
  doc.setFont('helvetica', 'normal')
  doc.text(billNo, CONTENT_RIGHT, ry, { align: 'right' })
  ry += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Periode Tagihan', metaLabelX, ry)
  doc.text(':', metaColonX, ry)
  doc.setFont('helvetica', 'normal')
  doc.text(
    new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
    CONTENT_RIGHT,
    ry,
    { align: 'right' },
  )

  // Left column: customer, on the same rows as the meta block.
  const customerMaxWidth = metaLabelX - MARGIN - 6
  let sy = topY
  doc.setFont('helvetica', 'bold')
  doc.text('Kepada Yth.', MARGIN, sy)
  sy += 5.5
  doc.setFont('helvetica', 'normal')
  doc.text(customer.company_name, MARGIN, sy, { maxWidth: customerMaxWidth })
  sy += 5.5
  if (customer.contact_person) {
    doc.text(customer.contact_person, MARGIN, sy, { maxWidth: customerMaxWidth })
    sy += 5.5
  }
  if (customer.address) {
    doc.text(customer.address, MARGIN, sy, { maxWidth: customerMaxWidth })
    sy += 5.5
  }

  return Math.max(sy, ry + 5.5) + 4
}

export async function buildBillPdf(
  nota: NotaListItem[],
  customer: Customer,
  business: Business,
  year: number,
  month: number,
): Promise<jsPDF> {
  const [{ jsPDF, autoTable }, logo] = await Promise.all([
    loadPdfLibs(),
    business.business_logo_key ? loadColorLogoDataUrl() : Promise.resolve(null),
  ])
  const doc = new jsPDF({ unit: 'mm', format: [PAGE_WIDTH, PAGE_HEIGHT] })
  const billNo = billNumber(customer, year, month)

  const tableStartY = drawLetterhead(doc, business, customer, billNo, year, month, logo)
  const total = nota.reduce((sum, n) => sum + totalBillOf(n), 0)

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: MARGIN, right: MARGIN },
    head: [['No.', 'Tanggal Nota', 'Kode Nota', 'Total Biaya']],
    body: nota.map((n, idx) => [String(idx + 1), n.nota_date, n.nota_number, fmt(totalBillOf(n))]),
    styles: { font: 'helvetica', fontSize: 11, cellPadding: 2.5 },
    headStyles: {
      fillColor: false,
      textColor: 0,
      fontStyle: 'bold',
      lineWidth: { bottom: 0.4 },
      lineColor: 0,
      valign: 'middle',
    },
    bodyStyles: { lineWidth: 0.1, lineColor: 220 },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 40 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 40, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 3) {
        data.cell.styles.halign = 'right'
      }
    },
  })

  const hasPayment = Boolean(business.payment_bank_name || business.payment_account_number)
  // Footer block: title + up to two lines, pinned to the bottom of the page.
  const footerTop = PAGE_HEIGHT - MARGIN - 21

  let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7
  if (hasPayment && finalY + 6 > footerTop - 6) {
    doc.addPage()
    finalY = MARGIN + 7
  }

  const labelX = 140
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('TOTAL', labelX, finalY)
  doc.text(fmt(total), CONTENT_RIGHT, finalY, { align: 'right' })

  if (hasPayment) {
    let payY = footerTop
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Pembayaran via Transfer', CONTENT_RIGHT, payY, { align: 'right' })
    payY += 7
    doc.setFont('helvetica', 'normal')
    if (business.payment_bank_name || business.payment_account_name) {
      doc.text(
        `${business.payment_bank_name ?? ''} a.n ${business.payment_account_name ?? ''}`.trim(),
        CONTENT_RIGHT,
        payY,
        { align: 'right' },
      )
      payY += 7
    }
    if (business.payment_account_number) {
      doc.text(`No. Rek : ${business.payment_account_number}`, CONTENT_RIGHT, payY, {
        align: 'right',
      })
    }
  }

  return doc
}

// In-memory only (not persisted server-side): a bill covers a whole month's
// worth of nota, which can still grow until the month closes out, so it's
// not immutable the way a single nota is. Cache key includes which nota
// (and their totals) went into it, so adding a nota invalidates it for free.
const pdfBlobCache = new Map<string, Blob>()

function billCacheKey(
  nota: NotaListItem[],
  customer: Customer,
  business: Business,
  year: number,
  month: number,
): string {
  const notaKey = nota.map((n) => `${n.nota_id}:${n.total_price}:${n.pajak_name}:${n.pajak_percentage}`).join(',')
  return `${billNumber(customer, year, month)}|${business.business_id}|${notaKey}`
}

async function getBillPdfBlob(
  nota: NotaListItem[],
  customer: Customer,
  business: Business,
  year: number,
  month: number,
): Promise<Blob> {
  const key = billCacheKey(nota, customer, business, year, month)
  const cached = pdfBlobCache.get(key)
  if (cached) return cached

  const doc = await buildBillPdf(nota, customer, business, year, month)
  const blob = doc.output('blob') as Blob
  pdfBlobCache.set(key, blob)
  return blob
}

// Call after anything that changes the PDF letterhead (logo, business
// details) — cached bill PDFs have the old one baked in.
export function clearBillPdfCache(): void {
  pdfBlobCache.clear()
}

export async function previewBillPdfUrl(
  nota: NotaListItem[],
  customer: Customer,
  business: Business,
  year: number,
  month: number,
): Promise<string> {
  const blob = await getBillPdfBlob(nota, customer, business, year, month)
  return URL.createObjectURL(blob)
}
