import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Business } from '@/lib/business'
import { getBusinessLogoUrl } from '@/lib/business'
import type { NotaDetail } from '@/lib/nota'

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 16
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN
const FOOTER_Y = 255
const FOOTER_RESERVE = PAGE_HEIGHT - FOOTER_Y + 8

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

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(getBusinessLogoUrl())
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
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

  let sy = headerBottom + 7
  const colonX = MARGIN + 32
  const valueX = colonX + 4
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('No. Nota', MARGIN, sy)
  doc.text(':', colonX, sy)
  doc.setFont('helvetica', 'normal')
  doc.text(nota.nota_number, valueX, sy)
  sy += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Tanggal Nota', MARGIN, sy)
  doc.text(':', colonX, sy)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDateLong(nota.nota_date), valueX, sy)
  sy += 12

  doc.setFont('helvetica', 'bold')
  doc.text('Kepada Yth.', MARGIN, sy)
  sy += 5.5
  doc.setFont('helvetica', 'normal')
  doc.text(nota.customer_company_name_snapshot, MARGIN, sy)
  sy += 5.5
  if (nota.contact_name_snapshot) {
    doc.text(nota.contact_name_snapshot, MARGIN, sy)
    sy += 5.5
  }
  if (nota.customer_address_snapshot) {
    doc.text(nota.customer_address_snapshot, MARGIN, sy, { maxWidth: CONTENT_RIGHT - MARGIN })
    sy += 5.5
  }

  const sectionBottom = sy + 2
  doc.line(MARGIN, sectionBottom, CONTENT_RIGHT, sectionBottom)

  return sectionBottom + 2
}

export async function buildNotaPdf(nota: NotaDetail, business: Business): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const logo = business.business_logo_key ? await loadLogoDataUrl() : null

  const tableStartY = drawLetterhead(doc, business, nota, logo)

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: MARGIN, right: MARGIN, bottom: FOOTER_RESERVE },
    head: [['No.', 'Nama Item', 'Qty', 'Unit', 'Harga', 'Total']],
    body: nota.items.map((item, idx) => [
      String(idx + 1),
      item.item_name_snapshot,
      String(item.qty),
      item.unit_snapshot,
      fmt(item.price),
      fmt(item.total_price),
    ]),
    styles: { font: 'helvetica', fontSize: 11, cellPadding: 2.5 },
    headStyles: {
      fillColor: false,
      textColor: 0,
      fontStyle: 'bold',
      lineWidth: { bottom: 0.4 },
      lineColor: 0,
      valign: 'middle',
      cellPadding: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 },
    },
    bodyStyles: { lineWidth: 0 },
    alternateRowStyles: { fillColor: false },
    columnStyles: {
      0: { cellWidth: 11 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 18, halign: 'right' },
      3: { cellWidth: 22 },
      4: { cellWidth: 32, halign: 'right' },
      5: { cellWidth: 32, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && [2, 4, 5].includes(data.column.index)) {
        data.cell.styles.halign = 'right'
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text(business.business_name, MARGIN, 16)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(`No. Nota  ${nota.nota_number} (lanjutan)`, MARGIN, 22)
        data.settings.margin.top = 28
      }
    },
  })

  let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  doc.setDrawColor(0)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, finalY, CONTENT_RIGHT, finalY)
  finalY += 7

  if (finalY > FOOTER_Y - 10) {
    doc.addPage()
    finalY = 20
  }

  const labelX = 140
  const valueX = CONTENT_RIGHT
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('TOTAL', labelX, finalY)
  doc.text(fmt(nota.total_price), valueX, finalY, { align: 'right' })

  if (business.payment_bank_name || business.payment_account_number) {
    let payY = FOOTER_Y
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

export async function downloadNotaPdf(nota: NotaDetail, business: Business): Promise<void> {
  const doc = await buildNotaPdf(nota, business)
  doc.save(`${nota.nota_number.replace(/\//g, '-')}.pdf`)
}

export async function previewNotaPdfUrl(nota: NotaDetail, business: Business): Promise<string> {
  const doc = await buildNotaPdf(nota, business)
  return doc.output('bloburl') as unknown as string
}
