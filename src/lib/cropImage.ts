import type { Area } from 'react-easy-crop'

export function getCroppedImageBlob(imageSrc: string, crop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = crop.width
      canvas.height = crop.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }
      ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to crop image'))
            return
          }
          resolve(blob)
        },
        'image/jpeg',
        0.9,
      )
    }
    image.onerror = () => reject(new Error('Failed to load image'))
    image.src = imageSrc
  })
}
