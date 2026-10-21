import { PrinterIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

// iPadOS is reported as "MacIntel" with touch support, so UA string alone
// can't distinguish it from a real Mac.
const IS_IOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

// iOS/iPadOS Safari frequently renders a blank <iframe src="blob:..."> for
// PDFs (embedded PDF viewer support is unreliable there). <object> works in
// more cases, and the "Open in new tab" link is a guaranteed fallback since
// Safari's native PDF viewer always handles a direct navigation.
function printPdf(url: string) {
  if (IS_IOS) {
    // iOS has no reliable programmatic print() for embedded PDFs; its own
    // full-page PDF viewer has a Print option in the share sheet.
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.top = '0'
  iframe.style.left = '-10000px'
  iframe.style.width = '100vw'
  iframe.style.height = '100vh'
  iframe.src = url
  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => iframe.remove(), 1000)
  }
  document.body.appendChild(iframe)
}

export function PdfPreviewFrame({
  title,
  url,
  frameClassName = 'h-[80vh] w-full rounded-md border',
}: {
  title: string
  url: string
  frameClassName?: string
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => printPdf(url)}>
          <PrinterIcon />
          Print
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open in new tab
          </a>
        </Button>
      </div>
      <object
        data={url}
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
