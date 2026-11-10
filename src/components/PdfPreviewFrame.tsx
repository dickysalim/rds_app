import { Download, PrinterIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

// iPadOS is reported as "MacIntel" with touch support, so UA string alone
// can't distinguish it from a real Mac.
const IS_IOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

// A hidden offscreen iframe used to drive print() here, but desktop Safari
// (macOS) renders it inconsistently -- the print dialog would flash and the
// iframe got removed before it settled. Opening the PDF in a real tab uses
// the browser's own PDF viewer (its "proper printing modal"), which prints
// reliably on Windows and macOS alike, to whatever digital printer is the
// OS/browser default -- separate from the dot-matrix path, which goes
// through QZ Tray instead of the browser.
function printPdf(url: string) {
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  if (!win || IS_IOS) return
  // iOS has no reliable programmatic print() for embedded PDFs; its own
  // full-page PDF viewer has a Print option in the share sheet instead.
  win.addEventListener('load', () => {
    win.focus()
    win.print()
  })
}

export function PdfPreviewFrame({
  title,
  url,
  frameClassName = 'h-[80vh] w-full rounded-md border',
  leftContent,
}: {
  title: string
  url: string
  frameClassName?: string
  leftContent?: ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">{leftContent}</div>
        <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => printPdf(url)}>
          <PrinterIcon />
          Print
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={url} download={`${title}.pdf`}>
            <Download />
            Download PDF
          </a>
        </Button>
        </div>
      </div>
      <object
        data={`${url}#toolbar=0&navpanes=0&scrollbar=0`}
        type="application/pdf"
        title={title}
        className={`min-h-0 flex-1 ${frameClassName}`}
      >
        <p className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
          Preview unavailable on this device.{' '}
          <a href={url} target="_blank" rel="noopener noreferrer" className="ml-1 underline">
            Open the PDF
          </a>
          .
        </p>
      </object>
    </div>
  )
}
