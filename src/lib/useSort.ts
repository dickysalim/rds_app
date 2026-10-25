import { useState } from 'react'
import type { SortDir } from '@/components/SortableTableHead'

export function useSort<T, K extends string>(
  defaultKey: K,
  defaultDir: SortDir = 'asc',
) {
  const [sortKey, setSortKey] = useState<K>(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)

  function toggle(key: K) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function applySort(rows: T[], getValue: (row: T, key: K) => string | number) {
    const sorted = rows.slice().sort((a, b) => {
      const va = getValue(a, sortKey)
      const vb = getValue(b, sortKey)
      if (typeof va === 'number' && typeof vb === 'number') return va - vb
      return String(va).localeCompare(String(vb))
    })
    if (sortDir === 'desc') sorted.reverse()
    return sorted
  }

  return { sortKey, sortDir, toggle, applySort }
}
