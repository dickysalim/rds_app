import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProductDialog } from '@/components/ProductDialog'
import { ProductHistoryDialog } from '@/components/ProductHistoryDialog'
import { SortableTableHead } from '@/components/SortableTableHead'
import { formatRupiah } from '@/lib/currency'
import type { Product } from '@/lib/products'
import { useDeleteProductMutation, useProductsQuery } from '@/lib/queries'
import { useSort } from '@/lib/useSort'

type ProductSortKey =
  | 'sku_id'
  | 'sku_name'
  | 'suggested_price'
  | 'cost_price'
  | 'profit_per_unit'
  | 'margin'
  | 'total_profit'

export function ProductPage() {
  const { data: products = [], isLoading: loading } = useProductsQuery()
  const deleteMutation = useDeleteProductMutation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)
  const [search, setSearch] = useState('')
  const { sortKey, sortDir, toggle, applySort } = useSort<Product, ProductSortKey>('sku_id', 'desc')

  function handleSaved() {
    // Mutations already invalidate the shared products query.
  }

  async function handleDelete() {
    if (!deletingProduct) return
    await deleteMutation.mutateAsync(deletingProduct.sku_id)
    setDeletingProduct(null)
  }

  const filteredProducts = applySort(
    products.filter((p) => p.sku_name.toLowerCase().includes(search.trim().toLowerCase())),
    (row, key) => {
      if (key === 'suggested_price') return row.suggested_price ?? 0
      if (key === 'cost_price') return row.cost_price ?? 0
      if (key === 'profit_per_unit') return (row.suggested_price ?? 0) - (row.cost_price ?? 0)
      if (key === 'margin')
        return row.suggested_price ? ((row.suggested_price - (row.cost_price ?? 0)) / row.suggested_price) : 0
      if (key === 'total_profit') return row.total_revenue - row.total_cost
      return row[key]
    },
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Product</h1>

      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Search SKU name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-80"
        />
        <Button
          onClick={() => {
            setEditingProduct(null)
            setDialogOpen(true)
          }}
        >
          + Add New Product
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border bg-panel shadow-sm border-[oklch(0.84_0_0)] [&_tr]:border-[oklch(0.86_0_0)]">
<Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead active={sortKey === 'sku_id'} dir={sortDir} onClick={() => toggle('sku_id')}>
              SKU ID
            </SortableTableHead>
            <SortableTableHead active={sortKey === 'sku_name'} dir={sortDir} onClick={() => toggle('sku_name')}>
              SKU Name
            </SortableTableHead>
            <SortableTableHead
              active={sortKey === 'suggested_price'}
              dir={sortDir}
              onClick={() => toggle('suggested_price')}
              className="min-w-56 text-left"
            >
              Suggested Price / Unit
            </SortableTableHead>
            <SortableTableHead
              active={sortKey === 'cost_price'}
              dir={sortDir}
              onClick={() => toggle('cost_price')}
              className="w-32 text-left"
            >
              Cost
            </SortableTableHead>
            <SortableTableHead
              active={sortKey === 'profit_per_unit'}
              dir={sortDir}
              onClick={() => toggle('profit_per_unit')}
              className="w-32 text-left"
            >
              Profit
            </SortableTableHead>
            <SortableTableHead
              active={sortKey === 'margin'}
              dir={sortDir}
              onClick={() => toggle('margin')}
              className="w-32 text-left"
            >
              Margin
            </SortableTableHead>
            <SortableTableHead
              active={sortKey === 'total_profit'}
              dir={sortDir}
              onClick={() => toggle('total_profit')}
              className="text-left"
            >
              Total Profit
            </SortableTableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          ) : filteredProducts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                {search ? 'No matching products.' : 'No products yet.'}
              </TableCell>
            </TableRow>
          ) : (
            filteredProducts.map((product) => (
              <TableRow key={product.sku_id}>
                <TableCell>{String(product.sku_id).padStart(3, '0')}</TableCell>
                <TableCell>{product.sku_name}</TableCell>
                <TableCell>
                  {product.suggested_price != null
                    ? `${formatRupiah(product.suggested_price)} / ${product.unit}`
                    : `- / ${product.unit}`}
                </TableCell>
                <TableCell>
                  {product.cost_price != null ? formatRupiah(product.cost_price) : '-'}
                </TableCell>
                <TableCell>
                  {product.suggested_price != null && product.cost_price != null
                    ? formatRupiah(product.suggested_price - product.cost_price)
                    : '-'}
                </TableCell>
                <TableCell>
                  {product.suggested_price ? `${Math.round(((product.suggested_price - (product.cost_price ?? 0)) / product.suggested_price) * 100)}%` : '-'}
                </TableCell>
                <TableCell className="text-[#3EA768] font-medium">
                  {formatRupiah(product.total_revenue - product.total_cost)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingProduct(product)
                          setDialogOpen(true)
                        }}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setHistoryProduct(product)}>
                        History
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeletingProduct(product)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
</div>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editingProduct}
        onSaved={handleSaved}
      />

      <ProductHistoryDialog
        open={!!historyProduct}
        onOpenChange={(open) => !open && setHistoryProduct(null)}
        skuId={historyProduct?.sku_id ?? null}
        skuName={historyProduct?.sku_name ?? null}
      />

      <AlertDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{deletingProduct?.sku_name}" from the product list. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
