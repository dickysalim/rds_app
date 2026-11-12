import type { jsPDF } from 'jspdf'
import type { Business } from '@/lib/business'
import { loadColorLogoDataUrl } from '@/lib/logoCache'
import type { Product } from '@/lib/products'

// jsPDF + jspdf-autotable are a large dependency only needed once a PDF is
// actually generated -- loaded lazily here instead of at module import time
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

function fmtQty(qty: number): string {
  return new Intl.NumberFormat('id-ID').format(qty)
}

const LOGO_SIZE = 28

function drawLetterhead(doc: jsPDF, business: Business, logo: string | null): number {
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

  const logoBottom = logo ? 14 + LOGO_SIZE : 0
  const headerBottom = Math.max(y, logoBottom) + 3
  doc.setDrawColor(0)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, headerBottom, CONTENT_RIGHT, headerBottom)

  let ty = headerBottom + 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Stock Opname', MARGIN, ty)
  ty += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(
    `Dicetak pada ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    MARGIN,
    ty,
  )
  ty += 5

  return ty
}

export async function buildStockOpnamePdf(products: Product[], business: Business): Promise<jsPDF> {
  const [{ jsPDF, autoTable }, logo] = await Promise.all([
    loadPdfLibs(),
    business.business_logo_key ? loadColorLogoDataUrl() : Promise.resolve(null),
  ])
  const doc = new jsPDF({ unit: 'mm', format: [PAGE_WIDTH, PAGE_HEIGHT] })

  const tableStartY = drawLetterhead(doc, business, logo)
  const sorted = products.slice().sort((a, b) => a.sku_name.localeCompare(b.sku_name))

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: MARGIN, right: MARGIN },
    head: [['No.', 'SKU ID', 'Nama Produk', 'Unit', 'Stok Saat Ini']],
    body: sorted.map((p, idx) => [
      String(idx + 1),
      String(p.sku_id).padStart(3, '0'),
      p.sku_name,
      p.unit,
      p.current_stock != null ? fmtQty(p.current_stock) : '-',
    ]),
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 2.5 },
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
      0: { cellWidth: 12 },
      1: { cellWidth: 20 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 20 },
      4: { cellWidth: 30, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 4) {
        data.cell.styles.halign = 'right'
      }
    },
  })

  return doc
}

// Stock levels change constantly -- never cached, always built fresh.
async function getStockOpnamePdfBlob(products: Product[], business: Business): Promise<Blob> {
  const doc = await buildStockOpnamePdf(products, business)
  return doc.output('blob') as Blob
}

export async function previewStockOpnamePdfUrl(products: Product[], business: Business): Promise<string> {
  const blob = await getStockOpnamePdfBlob(products, business)
  return URL.createObjectURL(blob)
}
