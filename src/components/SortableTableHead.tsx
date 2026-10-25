import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react'
import { TableHead } from '@/components/ui/table'

export type SortDir = 'asc' | 'desc'

interface SortableTableHeadProps {
  active: boolean
  dir: SortDir
  onClick: () => void
  className?: string
  children: React.ReactNode
}

export function SortableTableHead({
  active,
  dir,
  onClick,
  className,
  children,
}: SortableTableHeadProps) {
  const Icon = active ? (dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown

  return (
    <TableHead
      onClick={onClick}
      className={`cursor-pointer select-none ${className ?? ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <Icon className={`h-3.5 w-3.5 ${active ? 'text-foreground' : 'text-muted-foreground'}`} />
      </span>
    </TableHead>
  )
}
