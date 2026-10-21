import { jsPDF } from 'jspdf'
import type { Business } from '@/lib/business'
import { CAVEAT_FONT_BASE64 } from '@/lib/caveatFont'
import { generateGuillochePattern } from '@/lib/guillochePattern'
import { loadColorLogoDataUrl } from '@/lib/logoCache'
import { billNumber, type Payment } from '@/lib/nota'

// All buildPaymentPdf needs from a nota is its letterhead-level snapshot;
// any nota belonging to the same bill (customer + month) works.
type NotaLike = { nota_number: string; customer_company_name_snapshot: string }

const PAGE_WIDTH = 210
const MARGIN = 14
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN

function formatDateLong(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function fmt(amount: number): string {
  return new Intl.NumberFormat('id-ID').format(Math.round(amount))
}

const ORDINAL_ID = [
  '',
  'pertama',
  'kedua',
  'ketiga',
  'keempat',
  'kelima',
  'keenam',
  'ketujuh',
  'kedelapan',
  'kesembilan',
  'kesepuluh',
]

function ordinalId(n: number): string {
  return ORDINAL_ID[n] ?? `ke-${n}`
}

// payment_number: PAY/yymm/customerId-seq — seq is this payment's position
// within the bill period (customer + month), not per nota.
function paymentSeq(paymentNumber: string | null): number | null {
  if (!paymentNumber) return null
  const tail = paymentNumber.split('/').pop()?.split('-').pop()
  const n = Number(tail)
  return Number.isFinite(n) && n > 0 ? n : null
}

function billKeterangan(payment: Payment): [string, string] {
  const bill = billNumber(payment.customer_id, payment.bill_year, payment.bill_month)
  const bulan = new Date(payment.bill_year, payment.bill_month - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })
  const seq = paymentSeq(payment.payment_number)
  const ordinalPart = !payment.bill_settled && seq ? `${ordinalId(seq)} ` : ''
  return [`Pembayaran ${ordinalPart}untuk tagihan bulan ${bulan}`, `dengan kode ${bill}`]
}

const SATUAN = [
  '',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'delapan',
  'sembilan',
  'sepuluh',
  'sebelas',
]

function numberToWords(n: number): string {
  if (n < 12) return SATUAN[n]
  if (n < 20) return `${numberToWords(n - 10)} belas`
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const rest = n % 10
    return `${numberToWords(tens)} puluh${rest ? ` ${numberToWords(rest)}` : ''}`
  }
  if (n < 200) {
    const rest = n % 100
    return `seratus${rest ? ` ${numberToWords(rest)}` : ''}`
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100)
    const rest = n % 100
    return `${numberToWords(hundreds)} ratus${rest ? ` ${numberToWords(rest)}` : ''}`
  }
  if (n < 2000) {
    const rest = n % 1000
    return `seribu${rest ? ` ${numberToWords(rest)}` : ''}`
  }
  if (n < 1000000) {
    const thousands = Math.floor(n / 1000)
    const rest = n % 1000
    return `${numberToWords(thousands)} ribu${rest ? ` ${numberToWords(rest)}` : ''}`
  }
  if (n < 1000000000) {
    const millions = Math.floor(n / 1000000)
    const rest = n % 1000000
    return `${numberToWords(millions)} juta${rest ? ` ${numberToWords(rest)}` : ''}`
  }
  if (n < 1000000000000) {
    const billions = Math.floor(n / 1000000000)
    const rest = n % 1000000000
    return `${numberToWords(billions)} miliar${rest ? ` ${numberToWords(rest)}` : ''}`
  }
  const trillions = Math.floor(n / 1000000000000)
  const rest = n % 1000000000000
  return `${numberToWords(trillions)} triliun${rest ? ` ${numberToWords(rest)}` : ''}`
}

function terbilang(amount: number): string {
  const n = Math.round(amount)
  const words = n === 0 ? 'nol' : numberToWords(n).trim().replace(/\s+/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1) + ' rupiah'
}

const ROW_GAP = 8
// Distance between the two underlined lines of Jumlah / Keterangan.
const LINE_GAP = 7.5
const LOGO_SIZE = 16
const TOP_MARGIN = 12
const BOTTOM_MARGIN = 12
// Letterhead always reserves room for its 3 lines (address, contact, email)
// so the rest of the layout, and the page height, never shift per business.
const HEADER_BOTTOM = TOP_MARGIN + 25.5
const FIRST_ROW_Y = HEADER_BOTTOM + 12
// Rows: Sudah di terima dari, Pada tanggal, Jumlah (2 lines), Keterangan (2 lines).
const NOMINAL_GAP = 14
const NOMINAL_Y =
  FIRST_ROW_Y + ROW_GAP * 2 + (LINE_GAP + ROW_GAP) + LINE_GAP + NOMINAL_GAP
const PAGE_HEIGHT = NOMINAL_Y + 3 + BOTTOM_MARGIN
const LABEL_X = MARGIN
const COLON_X = MARGIN + 44
const VALUE_X = MARGIN + 48

function registerCaveatFont(doc: jsPDF) {
  doc.addFileToVFS('Caveat-Regular.ttf', CAVEAT_FONT_BASE64)
  doc.addFont('Caveat-Regular.ttf', 'Caveat', 'normal')
}

function valueLine(doc: jsPDF, value: string, y: number) {
  doc.setDrawColor(0)
  doc.setLineWidth(0.3)
  doc.line(VALUE_X, y + 1, CONTENT_RIGHT, y + 1)

  doc.setFont('Caveat', 'normal')
  doc.setFontSize(15)
  doc.text(value, VALUE_X + 2, y + 0.2, { maxWidth: CONTENT_RIGHT - VALUE_X - 2 })
}

function fieldRow(doc: jsPDF, label: string, value: string, y: number, labelY = y) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text(label, LABEL_X, labelY)
  doc.text(':', COLON_X, labelY)
  valueLine(doc, value, y)
}

// Jumlah (amount in words) always reserves two underlined lines, whether or
// not the value actually wraps — so the layout never shifts depending on
// payment amount. Same shape as the Keterangan row below it.
function twoLineField(doc: jsPDF, label: string, line1: string, line2: string, y: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text(label, LABEL_X, y)
  doc.text(':', COLON_X, y)

  doc.setFont('Caveat', 'normal')
  doc.setFontSize(15)
  if (line1) doc.text(line1, VALUE_X + 2, y + 0.2)
  if (line2) doc.text(line2, VALUE_X + 2, y + 0.2 + LINE_GAP)

  doc.setDrawColor(0)
  doc.setLineWidth(0.3)
  doc.line(VALUE_X, y + 1, CONTENT_RIGHT, y + 1)
  doc.line(VALUE_X, y + 1 + LINE_GAP, CONTENT_RIGHT, y + 1 + LINE_GAP)
}

export async function buildPaymentPdf(
  nota: NotaLike,
  payment: Payment,
  business: Business,
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: [PAGE_WIDTH, PAGE_HEIGHT], orientation: 'landscape' })
  registerCaveatFont(doc)
  const background = generateGuillochePattern(PAGE_WIDTH, PAGE_HEIGHT)
  if (background) {
    doc.addImage(background, 'PNG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT)
  }

  const logo = business.business_logo_key ? await loadColorLogoDataUrl() : null

  const textStartX = logo ? MARGIN + LOGO_SIZE + 4 : MARGIN
  if (logo) {
    doc.addImage(logo, MARGIN, TOP_MARGIN, LOGO_SIZE, LOGO_SIZE)
  }

  const nameMaxWidth = CONTENT_RIGHT - textStartX
  doc.setFont('helvetica', 'bold')
  let nameFontSize = 13
  doc.setFontSize(nameFontSize)
  while (nameFontSize > 8 && doc.getTextWidth(business.business_name) > nameMaxWidth) {
    nameFontSize -= 1
    doc.setFontSize(nameFontSize)
  }
  doc.text(business.business_name, textStartX, TOP_MARGIN + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  let hy = TOP_MARGIN + 10.5
  if (business.business_address) {
    doc.text(business.business_address, textStartX, hy)
    hy += 4
  }
  if (business.business_contact_person || business.business_contact_number) {
    const line = [business.business_contact_person, business.business_contact_number]
      .filter(Boolean)
      .join(' - ')
    doc.text(line, textStartX, hy)
    hy += 4
  }
  if (business.business_email) {
    doc.text(`Email: ${business.business_email}`, textStartX, hy)
    hy += 4
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('KWITANSI', CONTENT_RIGHT, TOP_MARGIN + 6, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(`No. : ${payment.payment_number ?? nota.nota_number}`, CONTENT_RIGHT, TOP_MARGIN + 12, {
    align: 'right',
  })

  doc.setDrawColor(0)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, HEADER_BOTTOM, CONTENT_RIGHT, HEADER_BOTTOM)

  let y = FIRST_ROW_Y
  fieldRow(doc, 'Sudah di terima dari', nota.customer_company_name_snapshot, y)
  y += ROW_GAP

  fieldRow(doc, 'Pada tanggal', formatDateLong(payment.payment_date), y)
  y += ROW_GAP

  const jumlahMaxWidth = CONTENT_RIGHT - VALUE_X - 2
  const [jumlahLine1 = '', jumlahLine2 = ''] = doc.splitTextToSize(
    terbilang(payment.amount),
    jumlahMaxWidth,
  ) as string[]
  twoLineField(doc, 'Jumlah', jumlahLine1, jumlahLine2, y)
  y += LINE_GAP + ROW_GAP

  const [keterangan1, keterangan2] = billKeterangan(payment)
  twoLineField(doc, 'Keterangan', keterangan1, keterangan2, y)
  y += LINE_GAP + NOMINAL_GAP
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Nominal', MARGIN + 8, y)
  doc.setDrawColor(0)
  doc.setLineWidth(0.4)
  const nominalBoxX = MARGIN + 30
  const nominalBoxW = 46
  doc.rect(nominalBoxX, y - 6, nominalBoxW, 9)
  doc.setFont('Caveat', 'normal')
  doc.setFontSize(18)
  doc.text(`Rp ${fmt(payment.amount)}`, nominalBoxX + nominalBoxW / 2, y - 0.5, { align: 'center' })

  if (business.business_contact_person) {
    doc.setFont('Caveat', 'normal')
    doc.setFontSize(22)
    doc.text(business.business_contact_person, CONTENT_RIGHT, y - 1, { align: 'right' })
    doc.setDrawColor(0)
    doc.setLineWidth(0.25)
    const signatureWidth = Math.min(50, CONTENT_RIGHT - MARGIN)
    doc.line(CONTENT_RIGHT - signatureWidth, y + 1.5, CONTENT_RIGHT, y + 1.5)
  }

  return doc
}

// Payments are immutable once recorded, so the receipt never changes.
// In-memory only cache: not worth a server round trip to persist since
// kwitansi are rarely re-downloaded compared to nota.
const pdfBlobCache = new Map<number, Blob>()

async function getPaymentPdfBlob(
  nota: NotaLike,
  payment: Payment,
  business: Business,
): Promise<Blob> {
  const cached = pdfBlobCache.get(payment.payment_id)
  if (cached) return cached

  const doc = await buildPaymentPdf(nota, payment, business)
  const blob = doc.output('blob') as Blob
  pdfBlobCache.set(payment.payment_id, blob)
  return blob
}

// Call after anything that changes the PDF letterhead (logo, business
// details) — cached receipts have the old one baked in.
export function clearPaymentPdfCache(): void {
  pdfBlobCache.clear()
}

export async function downloadPaymentPdf(
  nota: NotaLike,
  payment: Payment,
  business: Business,
): Promise<void> {
  const blob = await getPaymentPdfBlob(nota, payment, business)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const name = payment.payment_number ?? `${nota.nota_number}-payment-${payment.payment_id}`
  a.download = `${name.replace(/\//g, '-')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export async function previewPaymentPdfUrl(
  nota: NotaLike,
  payment: Payment,
  business: Business,
): Promise<string> {
  const blob = await getPaymentPdfBlob(nota, payment, business)
  return URL.createObjectURL(blob)
}
