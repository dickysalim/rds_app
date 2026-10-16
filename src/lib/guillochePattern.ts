const COLORS = [
  'rgba(120,150,210,ALPHA)',
  'rgba(190,150,210,ALPHA)',
  'rgba(190,200,120,ALPHA)',
]

function colorWithAlpha(template: string, alpha: number): string {
  return template.replace('ALPHA', alpha.toFixed(2))
}

function drawWeave(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const step = h / 70
  for (let i = 0; i < 3; i++) {
    const color = colorWithAlpha(COLORS[i], 0.12)
    ctx.strokeStyle = color
    ctx.lineWidth = 0.6
    const phase = (i * Math.PI) / 3
    for (let y = -step * 4; y < h + step * 4; y += step) {
      ctx.beginPath()
      for (let x = 0; x <= w; x += 4) {
        const wave = Math.sin(x / 26 + phase + y / 90) * (step * 0.9)
        const py = y + wave
        if (x === 0) ctx.moveTo(x, py)
        else ctx.lineTo(x, py)
      }
      ctx.stroke()
    }
  }
}

function drawRosette(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number) {
  const petals = 8
  const rings = 11
  const steps = 720

  for (let ring = 0; ring < rings; ring++) {
    const t = ring / (rings - 1)
    const color = colorWithAlpha(COLORS[ring % COLORS.length], 0.3)
    ctx.strokeStyle = color
    ctx.lineWidth = 0.7
    const R = baseRadius * (0.22 + t * 0.78)
    const modDepth = 0.32 - t * 0.08

    ctx.beginPath()
    for (let s = 0; s <= steps; s++) {
      const theta = (s / steps) * Math.PI * 2
      const bump = Math.pow(Math.abs(Math.cos((petals * theta) / 2)), 0.6)
      const r = R * (1 - modDepth + modDepth * bump)
      const px = cx + r * Math.cos(theta)
      const py = cy + r * Math.sin(theta)
      if (s === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.stroke()
  }

  const veinColor = colorWithAlpha(COLORS[1], 0.22)
  ctx.strokeStyle = veinColor
  ctx.lineWidth = 0.5
  for (let p = 0; p < petals; p++) {
    const angle = (p / petals) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + baseRadius * Math.cos(angle), cy + baseRadius * Math.sin(angle))
    ctx.stroke()
  }
}

export function generateGuillochePattern(pageWidthMm: number, pageHeightMm: number): string {
  const scale = 7
  const w = Math.round(pageWidthMm * scale)
  const h = Math.round(pageHeightMm * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  drawWeave(ctx, w, h)
  drawRosette(ctx, w / 2, h / 2, Math.min(w, h) * 0.46)

  return canvas.toDataURL('image/png')
}
