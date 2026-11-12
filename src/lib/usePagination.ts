import { useEffect, useState } from 'react'

export function usePagination<T>(rows: T[], pageSize = 50) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const paged = rows.slice((page - 1) * pageSize, page * pageSize)

  return { page, setPage, pageCount, paged }
}
