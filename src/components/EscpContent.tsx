import { buildNotaEscpLines, type NotaDocType } from '@/lib/notaEscp'
import type { Business } from '@/lib/business'
import type { NotaDetail } from '@/lib/nota'

export function EscpContent({
  nota,
  business,
  docType = 'nota_pembelian',
  className = '',
}: {
  nota: NotaDetail | null
  business: Business | null
  docType?: NotaDocType
  className?: string
}) {
  const lines = nota && business ? buildNotaEscpLines(nota, business, docType) : []

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
              height: '20px',
              ...(l.wide ? { letterSpacing: '0.12em' } : undefined),
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
              : l.text || ' '}
          </div>
        ))}
      </pre>
    </div>
  )
}
