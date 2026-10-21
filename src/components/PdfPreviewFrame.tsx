import { Button } from '@/components/ui/button'

// iOS/iPadOS Safari frequently renders a blank <iframe src="blob:..."> for
// PDFs (embedded PDF viewer support is unreliable there). <object> works in
// more cases, and the "Open in new tab" link is a guaranteed fallback since
// Safari's native PDF viewer always handles a direct navigation.
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
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open in new tab
          </a>
        </Button>
      </div>
      <object data={url} type="application/pdf" title={title} className={frameClassName}>
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
