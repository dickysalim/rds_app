export function formatRupiahInput(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return new Intl.NumberFormat('id-ID').format(Number(digits))
}

export function formatRupiah(amount: number): string {
  return `Rp${new Intl.NumberFormat('id-ID').format(amount)}`
}
