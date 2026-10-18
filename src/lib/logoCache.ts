import { getBusinessLogoUrl } from '@/lib/business'

// Shared across notaPdf.ts / billPdf.ts / paymentPdf.ts so the logo is only
// fetched once per session instead of once per PDF generated. Invalidate
// after a logo upload so the next PDF picks up the new image.

function toGrayscaleDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const { data } = imageData
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        data[i] = gray
        data[i + 1] = gray
        data[i + 2] = gray
      }
      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

async function fetchLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(getBusinessLogoUrl())
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

let colorLogoPromise: Promise<string | null> | null = null
let grayscaleLogoPromise: Promise<string | null> | null = null

export function loadColorLogoDataUrl(): Promise<string | null> {
  if (!colorLogoPromise) colorLogoPromise = fetchLogoDataUrl()
  return colorLogoPromise
}

export function loadGrayscaleLogoDataUrl(): Promise<string | null> {
  if (!grayscaleLogoPromise) {
    grayscaleLogoPromise = loadColorLogoDataUrl().then((dataUrl) =>
      dataUrl ? toGrayscaleDataUrl(dataUrl) : null,
    )
  }
  return grayscaleLogoPromise
}

export function invalidateLogoCache(): void {
  colorLogoPromise = null
  grayscaleLogoPromise = null
}
