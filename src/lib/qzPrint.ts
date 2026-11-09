import qz from 'qz-tray'

// Browser can't talk to a printer directly -- QZ Tray is a local background
// service (https://qz.io, free) that bridges this page to installed OS
// printers over a websocket. No signing certificate is configured here, so
// QZ Tray will show a one-time "allow this site?" prompt per session.
let securityConfigured = false

function ensureSecurity() {
  if (securityConfigured) return
  qz.security.setCertificatePromise((resolve: (cert: string) => void) => resolve(''))
  qz.security.setSignaturePromise(
    () => (resolve: (signature: string) => void) => resolve(''),
  )
  securityConfigured = true
}

async function ensureConnected(): Promise<void> {
  ensureSecurity()
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect()
  }
}

// The OS default printer is often a different (non-dot-matrix) device, so
// ESC/P jobs must target this printer explicitly rather than qz.printers.getDefault().
const DOT_MATRIX_PRINTER = 'EPSON_LX_310'

export async function printRawEscp(bytes: Uint8Array, printerName?: string): Promise<void> {
  try {
    await ensureConnected()
  } catch {
    throw new Error('Could not reach QZ Tray. Is it installed and running?')
  }

  const printer = printerName || DOT_MATRIX_PRINTER
  const config = qz.configs.create(printer, { rasterize: false })

  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const base64 = btoa(binary)

  await qz.print(config, [{ type: 'raw', format: 'base64', data: base64 }])
}
