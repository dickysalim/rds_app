import { jsPDF } from 'jspdf'
import type { Business } from '@/lib/business'
import { getBusinessLogoUrl } from '@/lib/business'
import { CAVEAT_FONT_BASE64 } from '@/lib/caveatFont'
import { generateGuillochePattern } from '@/lib/guillochePattern'
import type { NotaDetail, Payment } from '@/lib/nota'

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 99
const MARGIN = 14
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN

function fmt(amount: number): string {
  return new Intl.NumberFormat('id-ID').format(Math.round(amount))
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

const LOGO_SIZE = 16
const LABEL_X = MARGIN
const COLON_X = MARGIN + 44
const VALUE_X = MARGIN + 48

function registerCaveatFont(doc: jsPDF) {
  doc.addFileToVFS('Caveat-Regular.ttf', CAVEAT_FONT_BASE64)
  doc.addFont('Caveat-Regular.ttf', 'Caveat', 'normal')
}

function fieldRow(doc: jsPDF, label: string, value: string, y: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text(label, LABEL_X, y)
  doc.text(':', COLON_X, y)

  doc.setDrawColor(0)
  doc.setLineWidth(0.3)
  doc.line(VALUE_X, y + 1, CONTENT_RIGHT, y + 1)

  doc.setFont('Caveat', 'normal')
  doc.setFontSize(15)
  doc.text(value, VALUE_X + 2, y + 0.2, { maxWidth: CONTENT_RIGHT - VALUE_X - 2 })
}

export async function buildPaymentPdf(
  nota: NotaDetail,
  payment: Payment,
  business: Business,
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: [PAGE_WIDTH, PAGE_HEIGHT], orientation: 'landscape' })
  registerCaveatFont(doc)

  const background = generateGuillochePattern(PAGE_WIDTH, PAGE_HEIGHT)
  if (background) {
    doc.addImage(background, 'PNG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT)
  }

  const logo = business.business_logo_key ? await loadLogoDataUrl() : null

  const textStartX = logo ? MARGIN + LOGO_SIZE + 4 : MARGIN
  if (logo) {
    doc.addImage(logo, MARGIN, 10, LOGO_SIZE, LOGO_SIZE)
  }

  const nameMaxWidth = CONTENT_RIGHT - textStartX
  doc.setFont('helvetica', 'bold')
  let nameFontSize = 13
  doc.setFontSize(nameFontSize)
  while (nameFontSize > 8 && doc.getTextWidth(business.business_name) > nameMaxWidth) {
    nameFontSize -= 1
    doc.setFontSize(nameFontSize)
  }
  doc.text(business.business_name, textStartX, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  let hy = 20.5
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
  doc.text('KWITANSI', CONTENT_RIGHT, 16, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(`No. : ${payment.payment_number ?? nota.nota_number}`, CONTENT_RIGHT, 22, {
    align: 'right',
  })

  const headerBottom = Math.max(hy, 10 + LOGO_SIZE) + 3
  doc.setDrawColor(0)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, headerBottom, CONTENT_RIGHT, headerBottom)

  let y = headerBottom + 14
  fieldRow(doc, 'Sudah di terima dari', nota.customer_company_name_snapshot, y)

  y += 8
  const jumlahValue = `${terbilang(payment.amount)}`
  fieldRow(doc, 'Jumlah', jumlahValue, y)

  y += 8
  const keterangan = `Pembayaran untuk invoice ${nota.nota_number}`
  fieldRow(doc, 'Keterangan', keterangan, y)

  y += 16
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

  return doc
}

export async function downloadPaymentPdf(
  nota: NotaDetail,
  payment: Payment,
  business: Business,
): Promise<void> {
  const doc = await buildPaymentPdf(nota, payment, business)
  const name = payment.payment_number ?? `${nota.nota_number}-payment-${payment.payment_id}`
  doc.save(`${name.replace(/\//g, '-')}.pdf`)
}

export async function previewPaymentPdfUrl(
  nota: NotaDetail,
  payment: Payment,
  business: Business,
): Promise<string> {
  const doc = await buildPaymentPdf(nota, payment, business)
  return doc.output('bloburl') as unknown as string
}
