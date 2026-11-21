import { printRawEscp } from '@/lib/qzPrint'

export interface Business {
  business_name: string
  business_address: string | null
  business_contact_person: string | null
  business_contact_number: string | null
  business_email: string | null
  payment_bank_name: string | null
  payment_account_name: string | null
  payment_account_number: string | null
}

export interface NotaDetail {
  nota_number: string
  nota_date: string
  customer_company_name_snapshot: string
  customer_address_snapshot: string | null
  contact_name_snapshot: string | null
  total_price: number
  notes: string | null
  pajak_name: string | null
  pajak_percentage: number | null
  items: {
    item_name_snapshot: string
    unit_snapshot: string
    qty: number
    price: number
    total_price: number
  }[]
}

// Raw ESC/P output for the Epson LX-310 (9-pin dot matrix). Text-only: sent
// straight to the printer's own character generator, so it prints in a
// fraction of the time a graphics (PDF) page takes. No logo, no fonts to
// embed. The browser can't talk to the printer directly, so this produces a
// .prn file to be sent raw (Windows: `copy /b file.prn \\PC\share`,
// Mac/Linux: `lpr -o raw file.prn`).

// 10 cpi (pica) on 8" printable width = 80 columns.
const COLS = 80

// Physical sheet length of the user's continuous (fanfold) dot-matrix
// paper -- the form feed always advances exactly this far, landing on the
// next sheet's top-of-form regardless of how much the nota's content fills.
const PAGE_LENGTH_INCHES = 11

const ESC = 0x1b
const FF = 0x0c
const CR_LF = [0x0d, 0x0a]

const COL_NO = 3
const COL_QTY = 6
const COL_UNIT = 6
const COL_PRICE = 11
const COL_TOTAL = 12
const COL_GAP = 1
const COL_NAME = COLS - (COL_NO + COL_QTY + COL_UNIT + COL_PRICE + COL_TOTAL) - COL_GAP * 5
// Surat Jalan has no price/total columns -- the item name gets that width back.
const COL_NAME_SJ = COLS - (COL_NO + COL_QTY + COL_UNIT) - COL_GAP * 3

const META_WIDTH = 34
const CUSTOMER_WIDTH = COLS - META_WIDTH - 2

// Closing-rule drop below the last item's row, in 1/216" (ESC J units). One
// full text line at 1/6" spacing is 36; 0 sits flush on the item text, 36 is
// a whole row away. Tune this one number to move the rule up or down.
export const OVERPRINT_DROP = 8
export const LINE_UNITS = 36
// Extra feed after the closing rule so the line below (Subtotal) clears it by
// the same gap the rule has under the last item.
export const OVERPRINT_GAP_AFTER = 8

// Left column for Catatan when it sits beside the totals block; the totals
// block keeps the remaining right-hand columns.
const NOTES_WIDTH = 44

const BOX_WIDTH = 20
const BOX_GAP = 2
const PAYMENT_WIDTH = COLS - BOX_WIDTH * 2 - BOX_GAP * 2

// Single-line box-drawing glyph for the signature line. Not in plain ASCII,
// so ascii() below lets it through untouched and buildNotaEscp's text() maps
// it to its PC437 byte code -- the printer's default character table -- so
// it prints as a real connected line instead of a dashed mockup.
const BOX_H = '─'
const CP437_BOX: Record<string, number> = {
  [BOX_H]: 0xc4,
}

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

// The printer's default charset is plain ASCII — strip accents, replace the rest.
function ascii(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e─]/g, '?')
}

function wrap(text: string, width: number): string[] {
  const out: string[] = []
  let line = ''
  for (const rawWord of ascii(text).split(/\s+/).filter(Boolean)) {
    let word = rawWord
    while (word.length > width) {
      if (line) {
        out.push(line)
        line = ''
      }
      out.push(word.slice(0, width))
      word = word.slice(width)
    }
    if (!line) line = word
    else if (line.length + 1 + word.length <= width) line += ` ${word}`
    else {
      out.push(line)
      line = word
    }
  }
  if (line) out.push(line)
  return out.length ? out : ['']
}

const left = (s: string, w: number) => s.slice(0, w).padEnd(w)
const right = (s: string, w: number) => s.slice(0, w).padStart(w)

export type EscpSegment = { text: string; bold?: boolean; underline?: boolean }
export type EscpLine = {
  text: string
  bold?: boolean
  wide?: boolean
  underline?: boolean
  segments?: EscpSegment[]
  // Printed on the same row after a bare CR (no line feed), so the glyphs
  // overstrike the row's text. Used to seat the closing rule right under the
  // last item: an underscore sits at the bottom of its own row, so on a row
  // of its own it always looks a full line away from the item above.
  overprint?: string
}

export type NotaDocType = 'nota_pembelian' | 'surat_jalan'

// Rapid-test variants: each one changes only the printer-side ESC/P commands
// (init codes + style on/off), not the 80-column text layout, so a user can
// print Type 1..4 back-to-back and compare on the real printer. Edit the
// options below to tune a type; add a type by extending this table.
export type EscpVariant = 'control' | 'type1' | 'type2' | 'type3' | 'type4'

export type EscpVariantOptions = {
  label: string
  description: string
  nlq: boolean // ESC x 1: letter quality, slower but cleaner
  bold: boolean // honor bold lines/segments (ESC E / ESC F)
  underline: boolean // honor underline (ESC - 1 / ESC - 0)
  wide: boolean // honor double-width title (ESC W 1 / ESC W 0)
  doubleStrike: boolean // ESC G: print each line twice for darker text
  compactItems: boolean // drop the blank row between the table header rule and item 1
  compactSignature: boolean // signature name lines share the row of the last payment line (No. Rek)
  signatureParens: boolean // wrap the signature name line in ( )
  compactNotes: boolean // Catatan beside the totals block (Nota Pembelian) instead of below it
  closeTable: boolean // closing rule overprinted on the last item's row (CR, no LF) instead of its own row
}

export const ESCP_VARIANTS: Record<EscpVariant, EscpVariantOptions> = {
  // Control: byte-for-byte what production prints today. Never tune this one;
  // it is the baseline every other type is compared against.
  control: {
    label: 'Control',
    description: 'This is what the production use',
    nlq: true,
    bold: true,
    underline: true,
    wide: true,
    doubleStrike: false,
    compactItems: false,
    compactSignature: false,
    signatureParens: true,
    compactNotes: false,
    closeTable: false,
  },
  type1: {
    label: 'Type 1',
    description: 'NLQ, bold + underline + wide title',
    nlq: true,
    bold: true,
    underline: true,
    wide: true,
    doubleStrike: false,
    compactItems: true,
    compactSignature: true,
    signatureParens: false,
    compactNotes: false,
    closeTable: true,
  },
  type2: {
    label: 'Type 2',
    description: 'Draft (fast), bold + underline + wide title',
    nlq: false,
    bold: true,
    underline: true,
    wide: true,
    doubleStrike: false,
    compactItems: false,
    compactSignature: false,
    signatureParens: true,
    compactNotes: false,
    closeTable: false,
  },
  type3: {
    label: 'Type 3',
    description: 'NLQ, plain: no bold / underline / wide',
    nlq: true,
    bold: false,
    underline: false,
    wide: false,
    doubleStrike: false,
    compactItems: false,
    compactSignature: false,
    signatureParens: true,
    compactNotes: false,
    closeTable: false,
  },
  type4: {
    label: 'Type 4',
    description: 'NLQ + double-strike (darker), bold + underline + wide title',
    nlq: true,
    bold: true,
    underline: true,
    wide: true,
    doubleStrike: true,
    compactItems: false,
    compactSignature: false,
    signatureParens: true,
    compactNotes: false,
    closeTable: false,
  },
}

export const ESCP_VARIANT_KEYS = Object.keys(ESCP_VARIANTS) as EscpVariant[]

export function buildNotaEscpLines(
  nota: NotaDetail,
  business: Business,
  docType: NotaDocType = 'nota_pembelian',
  variant: EscpVariant = 'control',
): EscpLine[] {
  const { compactItems, closeTable, compactSignature, signatureParens, compactNotes } = ESCP_VARIANTS[variant]
  const closeTableRule = () => {
    const last = lines[lines.length - 1]
    if (closeTable && nota.items.length > 0 && last && !last.segments) last.overprint = rule
    else push(rule)
  }
  const isSuratJalan = docType === 'surat_jalan'
  const lines: EscpLine[] = []
  const rule = '_'.repeat(COLS)
  const push = (text: string, opts: Omit<EscpLine, 'text'> = {}) =>
    lines.push({ text: ascii(text), ...opts })

  // Letterhead
  const name = ascii(business.business_name)
  if (name.length <= COLS / 2) push(name, { bold: true, wide: true })
  else wrap(name, COLS).forEach((l) => push(l, { bold: true }))
  if (business.business_address) wrap(business.business_address, COLS).forEach((l) => push(l))
  const contact = [business.business_contact_person, business.business_contact_number]
    .filter(Boolean)
    .join(' - ')
  if (contact) push(contact)
  if (business.business_email) push(`Email: ${business.business_email}`)
  closeTableRule()
  push('')

  {
    const label = isSuratJalan ? 'SURAT JALAN' : 'NOTA PEMBELIAN'
    const padLeft = Math.max(0, Math.floor((COLS - label.length) / 2))
    lines.push({
      text: ascii(' '.repeat(padLeft) + label),
      segments: [{ text: ' '.repeat(padLeft) }, { text: label, bold: true, underline: true }],
    })
    push('')
  }

  // Customer (left) + nota meta (right), on the same rows.
  const customerLines = ['Kepada Yth.']
  wrap(nota.customer_company_name_snapshot, CUSTOMER_WIDTH).forEach((l) => customerLines.push(l))
  if (nota.contact_name_snapshot) wrap(nota.contact_name_snapshot, CUSTOMER_WIDTH).forEach((l) => customerLines.push(l))
  if (nota.customer_address_snapshot) wrap(nota.customer_address_snapshot, CUSTOMER_WIDTH).forEach((l) => customerLines.push(l))
  const metaRows = [
    ['No. Nota     :', nota.nota_number],
    ['Tanggal Nota :', formatDateLong(nota.nota_date)],
  ].map(([label, value]) => {
    const full = ascii(`${label} ${value}`)
    const pad = ' '.repeat(Math.max(0, META_WIDTH - full.length))
    return { label: pad + ascii(label), value: ` ${ascii(value)}`, full: pad + full }
  })
  const headRows = Math.max(customerLines.length, metaRows.length)
  for (let i = 0; i < headRows; i++) {
    const l = left(customerLines[i] ?? '', CUSTOMER_WIDTH)
    const r = metaRows[i]
    if (r) {
      lines.push({
        text: ascii(`${l}  ${r.full}`.trimEnd()),
        segments: [{ text: ascii(`${l}  `) }, { text: r.label, bold: true }, { text: r.value }],
      })
    } else {
      push(l.trimEnd())
    }
  }
  push('')
  push(rule)

  // Items table
  const gap = ' '.repeat(COL_GAP)
  if (isSuratJalan) {
    push(
      [left('No.', COL_NO), left('Nama Item', COL_NAME_SJ), right('Qty', COL_QTY), left('Unit', COL_UNIT)].join(
        gap,
      ),
      { bold: true },
    )
    closeTableRule()
    if (!compactItems) push('')
    nota.items.forEach((item, idx) => {
      const nameLines = wrap(item.item_name_snapshot, COL_NAME_SJ)
      nameLines.forEach((nl, i) => {
        push(
          [
            left(i === 0 ? String(idx + 1) : '', COL_NO),
            left(nl, COL_NAME_SJ),
            right(i === 0 ? String(item.qty) : '', COL_QTY),
            left(i === 0 ? item.unit_snapshot : '', COL_UNIT),
          ]
            .join(gap)
            .trimEnd(),
        )
      })
    })
    closeTableRule()
  } else {
    push(
      [
        left('No.', COL_NO),
        left('Nama Item', COL_NAME),
        right('Qty', COL_QTY),
        left('Unit', COL_UNIT),
        right('Harga', COL_PRICE),
        right('Total', COL_TOTAL),
      ].join(gap),
      { bold: true },
    )
    closeTableRule()
    if (!compactItems) push('')
    nota.items.forEach((item, idx) => {
      const nameLines = wrap(item.item_name_snapshot, COL_NAME)
      nameLines.forEach((nl, i) => {
        push(
          [
            left(i === 0 ? String(idx + 1) : '', COL_NO),
            left(nl, COL_NAME),
            right(i === 0 ? String(item.qty) : '', COL_QTY),
            left(i === 0 ? item.unit_snapshot : '', COL_UNIT),
            right(i === 0 ? fmt(item.price) : '', COL_PRICE),
            right(i === 0 ? fmt(item.total_price) : '', COL_TOTAL),
          ]
            .join(gap)
            .trimEnd(),
        )
      })
    })
    closeTableRule()
    const totalLabelWidth = COLS - COL_TOTAL - COL_GAP
    const totalsRows: { text: string; bold?: boolean }[] = []
    if (nota.pajak_name && nota.pajak_percentage != null) {
      const pajakValue = (nota.total_price * nota.pajak_percentage) / 100
      totalsRows.push({ text: `${right('Subtotal', totalLabelWidth)}${gap}${right(fmt(nota.total_price), COL_TOTAL)}` })
      totalsRows.push({
        text: `${right(`${nota.pajak_name} (${nota.pajak_percentage}%)`, totalLabelWidth)}${gap}${right(fmt(pajakValue), COL_TOTAL)}`,
      })
      totalsRows.push({
        text: `${right('TOTAL', totalLabelWidth)}${gap}${right(fmt(nota.total_price + pajakValue), COL_TOTAL)}`,
        bold: true,
      })
    } else {
      totalsRows.push({
        text: `${right('TOTAL', totalLabelWidth)}${gap}${right(fmt(nota.total_price), COL_TOTAL)}`,
        bold: true,
      })
    }

    if (compactNotes && nota.notes) {
      // Catatan sits left of the totals block, on the same rows. Long notes
      // wrap inside NOTES_WIDTH and keep running down the left column below
      // the totals rows (the right side just stays blank there).
      const catatanLabel = 'Catatan : '
      const noteLines = wrap(nota.notes, NOTES_WIDTH - catatanLabel.length)
      const rows = Math.max(noteLines.length, totalsRows.length)
      for (let i = 0; i < rows; i++) {
        const leftSegs: EscpSegment[] =
          i < noteLines.length
            ? i === 0
              ? [{ text: ascii(catatanLabel), bold: true }, { text: left(noteLines[i], NOTES_WIDTH - catatanLabel.length) }]
              : [{ text: left(' '.repeat(catatanLabel.length) + noteLines[i], NOTES_WIDTH) }]
            : [{ text: ' '.repeat(NOTES_WIDTH) }]
        const t = totalsRows[i]
        const segments: EscpSegment[] = [...leftSegs]
        if (t) segments.push({ text: t.text.slice(NOTES_WIDTH), bold: t.bold })
        lines.push({ text: ascii(segments.map((x) => x.text).join('').trimEnd()), segments })
      }
    } else {
      totalsRows.forEach((t) => push(t.text, t.bold ? { bold: true } : {}))
    }
  }

  if (nota.notes && !(compactNotes && !isSuratJalan)) {
    push('')
    const catatanLabel = 'Catatan : '
    const wrapped = wrap(nota.notes, COLS - catatanLabel.length)
    wrapped.forEach((l, i) => {
      if (i === 0) {
        lines.push({
          text: ascii(catatanLabel + l),
          segments: [{ text: ascii(catatanLabel), bold: true }, { text: ascii(l) }],
        })
      } else {
        push(' '.repeat(catatanLabel.length) + l)
      }
    })
  }

  // Signature labels side by side (left) + payment info (right), on the same rows.
  const signatureBox = (label: string): string[] => {
    const blank = ' '.repeat(BOX_WIDTH)
    const nameLine = signatureParens ? `(${BOX_H.repeat(BOX_WIDTH - 2)})` : BOX_H.repeat(BOX_WIDTH - 2)
    // Compact: label, two blank rows, name line. Payment block stays top-aligned
    // with the label row, so the name line lands one row below No. Rek.
    if (compactSignature) return [left(label, BOX_WIDTH), blank, blank, nameLine]
    return [left(label, BOX_WIDTH), blank, blank, blank, blank, nameLine]
  }
  const hormatBox = signatureBox('Hormat Kami,')
  const terimaBox = signatureBox('Tanda Terima,')

  const paymentLines: { text: string; bold?: boolean }[] = []
  if (
    !isSuratJalan &&
    (business.payment_bank_name || business.payment_account_name || business.payment_account_number)
  ) {
    paymentLines.push({ text: 'Pembayaran via Transfer', bold: true })
    if (business.payment_bank_name || business.payment_account_name) {
      paymentLines.push({
        text: `${business.payment_bank_name ?? ''} a.n ${business.payment_account_name ?? ''}`.trim(),
      })
    }
    if (business.payment_account_number) {
      paymentLines.push({ text: `No. Rek : ${business.payment_account_number}` })
    }
  }

  push('')
  push('')
  const boxGap = ' '.repeat(BOX_GAP)
  const footerRows = Math.max(hormatBox.length, terimaBox.length, paymentLines.length)
  for (let i = 0; i < footerRows; i++) {
    const b1 = left(hormatBox[i] ?? '', BOX_WIDTH)
    const b2 = left(terimaBox[i] ?? '', BOX_WIDTH)
    const p = paymentLines[i]
    const r = right(p?.text ?? '', PAYMENT_WIDTH)
    if (p?.bold) {
      lines.push({
        text: ascii(`${b1}${boxGap}${b2}${boxGap}${r}`.trimEnd()),
        segments: [{ text: ascii(`${b1}${boxGap}${b2}${boxGap}`) }, { text: ascii(r), bold: true }],
      })
    } else {
      push(`${b1}${boxGap}${b2}${boxGap}${r}`.trimEnd())
    }
  }

  push('')

  return lines
}

export function buildNotaEscp(
  nota: NotaDetail,
  business: Business,
  docType: NotaDocType = 'nota_pembelian',
  variant: EscpVariant = 'control',
): Uint8Array {
  const lines = buildNotaEscpLines(nota, business, docType, variant)
  const opt = ESCP_VARIANTS[variant]

  // Bytes
  const bytes: number[] = []
  const emit = (...b: number[]) => bytes.push(...b)
  const text = (s: string) => {
    for (let i = 0; i < s.length; i++) bytes.push(CP437_BOX[s[i]] ?? s.charCodeAt(i))
  }

  emit(ESC, 0x40) // ESC @ — reset
  emit(ESC, 0x50) // ESC P — 10 cpi
  emit(ESC, 0x78, opt.nlq ? 0x01 : 0x00) // ESC x n — NLQ (letter quality) on/off
  if (opt.doubleStrike) emit(ESC, 0x47) // ESC G — double-strike on
  emit(ESC, 0x32) // ESC 2 — 1/6" line spacing

  emit(...CR_LF) // top margin
  for (const l of lines) {
    if (l.segments) {
      for (const seg of l.segments) {
        const bold = seg.bold && opt.bold
        const underline = seg.underline && opt.underline
        if (bold) emit(ESC, 0x45) // bold on
        if (underline) emit(ESC, 0x2d, 0x01) // underline on
        text(seg.text)
        if (underline) emit(ESC, 0x2d, 0x00) // underline off
        if (bold) emit(ESC, 0x46) // bold off
      }
    } else {
      const bold = l.bold && opt.bold
      const underline = l.underline && opt.underline
      const wide = l.wide && opt.wide
      if (bold) emit(ESC, 0x45) // bold on
      if (underline) emit(ESC, 0x2d, 0x01) // ESC - 1 — underline on
      if (wide) emit(ESC, 0x57, 0x01) // double width on
      text(l.text)
      if (wide) emit(ESC, 0x57, 0x00)
      if (underline) emit(ESC, 0x2d, 0x00) // underline off
      if (bold) emit(ESC, 0x46) // bold off
    }
    if (l.overprint) {
      emit(0x0d) // CR only: back to column 1, same row
      emit(ESC, 0x4a, OVERPRINT_DROP) // ESC J n: feed n/216" down, no CR
      text(l.overprint)
      emit(0x0d) // CR
      emit(ESC, 0x4a, LINE_UNITS - OVERPRINT_DROP + OVERPRINT_GAP_AFTER) // finish the line + clear gap
    } else {
      emit(...CR_LF)
    }
  }

  // Page length in inches (ESC C 0 n), set right before the form feed it
  // governs -- issuing it earlier (before any content) snaps the print head
  // to top-of-form immediately, eating the first few lines. Fixed to the
  // physical sheet length of the user's 9.5x11" fanfold paper -- sizing it
  // off the content's own line count instead drifts the form feed away from
  // the real perforation a little more on every nota, until prints land
  // mid-sheet instead of at the top of the next one.
  emit(ESC, 0x43, 0x00, PAGE_LENGTH_INCHES)
  emit(FF) // eject to next page top
  if (opt.doubleStrike) emit(ESC, 0x48) // ESC H — double-strike off

  return new Uint8Array(bytes)
}

export async function printNotaEscp(
  nota: NotaDetail,
  business: Business,
  printerName?: string,
  docType: NotaDocType = 'nota_pembelian',
  variant: EscpVariant = 'control',
): Promise<void> {
  const bytes = buildNotaEscp(nota, business, docType, variant)
  await printRawEscp(bytes, printerName)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Fallback for PCs without QZ Tray installed: renders the same lines as
// plain HTML in a hidden iframe and uses the browser's own print dialog, so
// Print still produces output even with no raw-printer bridge available.
export function printNotaEscpViaBrowser(
  nota: NotaDetail,
  business: Business,
  docType: NotaDocType = 'nota_pembelian',
  variant: EscpVariant = 'control',
): void {
  const lines = buildNotaEscpLines(nota, business, docType, variant)
  const rows = lines
    .map((l) => {
      const style = [
        l.bold && 'font-weight:bold',
        l.underline && 'text-decoration:underline',
        l.wide && 'letter-spacing:0.12em',
      ]
        .filter(Boolean)
        .join(';')
      const content = l.segments
        ? l.segments
            .map((s) => {
              const segStyle = [s.bold && 'font-weight:bold', s.underline && 'text-decoration:underline']
                .filter(Boolean)
                .join(';')
              return `<span style="${segStyle}">${escapeHtml(s.text)}</span>`
            })
            .join('')
        : escapeHtml(l.text) || '&nbsp;'
      const over = l.overprint
        ? `<span style="position:absolute;left:0;top:${(OVERPRINT_DROP * 20) / LINE_UNITS}px">${escapeHtml(l.overprint)}</span>`
        : ''
      return `<div style="position:relative;height:${20 + (l.overprint ? (OVERPRINT_GAP_AFTER * 20) / LINE_UNITS : 0)}px;${style}">${content}${over}</div>`
    })
    .join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;padding:12px;}
    pre{font-family:monospace;font-size:14px;line-height:20px;white-space:pre;margin:0;}
  </style></head><body><pre>${rows}</pre></body></html>`

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.top = '0'
  iframe.style.left = '-10000px'
  iframe.style.width = '100vw'
  iframe.style.height = '100vh'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (!doc) {
    iframe.remove()
    return
  }
  doc.open()
  doc.write(html)
  doc.close()
  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => iframe.remove(), 1000)
  }
}

