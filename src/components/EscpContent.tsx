import { buildNotaEscpLines, LINE_UNITS, OVERPRINT_DROP, lineUnits, type Business, type NotaDetail, type EscpVariant, type NotaDocType } from '@/lib/notaEscp'

export function EscpContent({
  nota,
  business,
  docType = 'nota_pembelian',
  variant = 'type1',
  className = '',
}: {
  nota: NotaDetail | null
  business: Business | null
  docType?: NotaDocType
  variant?: EscpVariant
  className?: string
}) {
  const lines = nota && business ? buildNotaEscpLines(nota, business, docType, variant) : []

  return (
    <div className={`flex justify-center overflow-auto rounded-md border bg-white p-6 ${className}`}>
      <pre className="w-max font-mono text-base text-black" style={{ lineHeight: '20px' }}>
        {lines.map((l, i) => (
          // Every line is one CR_LF on the printer, so every row -- rule,
          // blank, or text -- gets the same fixed height here: this mirrors
          // actual printed spacing, not just how the glyphs happen to render.
          <div
            key={i}
            className={[l.bold && 'font-bold', l.underline && 'underline'].filter(Boolean).join(' ') || undefined}
            style={{
              position: 'relative',
              height: `${(lineUnits(l) * 20) / LINE_UNITS}px`,
            }}
          >
            {l.segments
              ? l.segments.map((s, j) => (
                  <span
                    key={j}
                    className={
                      [s.bold && 'font-bold', s.underline && 'underline'].filter(Boolean).join(' ') || undefined
                    }
                  >
                    {s.text}
                  </span>
                ))
              : l.wide
                ? (
                    // ESC W 1: printer draws each glyph at double width (2 columns).
                    <span className="inline-block origin-left" style={{ transform: 'scaleX(2)' }}>
                      {l.text}
                    </span>
                  )
                : l.text || ' '}
            {l.overprint && (
              <span className="absolute left-0" style={{ top: `${((l.overprintDrop ?? OVERPRINT_DROP) * 20) / LINE_UNITS}px` }}>
                {l.overprint}
              </span>
            )}
          </div>
        ))}
      </pre>
    </div>
  )
}
