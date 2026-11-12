import { MoreHorizontal, PrinterIcon } from 'lucide-react'
import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PdfPreviewFrame } from '@/components/PdfPreviewFrame'
import { AdjustStockDialog } from '@/components/AdjustStockDialog'
import type { AppOutletContext } from '@/components/AppLayout'
import { Pagination } from '@/components/Pagination'
import { ProductDialog } from '@/components/ProductDialog'
import { ProductHistoryDialog } from '@/components/ProductHistoryDialog'
import { SortableTableHead } from '@/components/SortableTableHead'
import { Card, CardContent } from '@/components/ui/card'
import { formatQty, formatRupiah } from '@/lib/currency'
import { hideFinancials } from '@/lib/access'
import type { Product } from '@/lib/products'
import { useBusinessQuery, useDeleteProductMutation, useProductsQuery } from '@/lib/queries'
import { usePagination } from '@/lib/usePagination'
import { previewStockOpnamePdfUrl } from '@/lib/stockOpnamePdf'
import { useSort } from '@/lib/useSort'

type ProductSortKey =
  | 'sku_id'
  | 'sku_name'
  | 'suggested_price'
  | 'cost_price'
  | 'revenue_value'
  | 'stock_value'
  | 'current_stock'

export function ProductPage() {
  const { user } = useOutletContext<AppOutletContext>()
  const hideCost = hideFinancials(user.role)
  const { data: products = [], isLoading: loading } = useProductsQuery()
  const { data: business } = useBusinessQuery()
  const deleteMutation = useDeleteProductMutation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null)
  const [search, setSearch] = useState('')
  const [opnamePdfUrl, setOpnamePdfUrl] = useState<string | null>(null)
  const [opnamePdfLoading, setOpnamePdfLoading] = useState(false)
  const [opnamePdfError, setOpnamePdfError] = useState<string | null>(null)
  const { sortKey, sortDir, toggle, applySort } = useSort<Product, ProductSortKey>('sku_id', 'desc')

  function handleSaved() {
    // Mutations already invalidate the shared products query.
  }

  async function handleDelete() {
    if (!deletingProduct) return
    await deleteMutation.mutateAsync(deletingProduct.sku_id)
    setDeletingProduct(null)
  }

  function closeOpnamePdf() {
    if (opnamePdfUrl) URL.revokeObjectURL(opnamePdfUrl)
    setOpnamePdfUrl(null)
    setOpnamePdfError(null)
  }

  async function handlePrintStockOpname() {
    setOpnamePdfLoading(true)
    setOpnamePdfError(null)
    try {
      if (!business) throw new Error('Set up Business Settings first')
      const url = await previewStockOpnamePdfUrl(products, business)
      setOpnamePdfUrl(url)
    } catch (err) {
      setOpnamePdfError(err instanceof Error ? err.message : 'Failed to generate PDF')
    } finally {
      setOpnamePdfLoading(false)
    }
  }

  const filteredProducts = applySort(
    products.filter((p) => p.sku_name.toLowerCase().includes(search.trim().toLowerCase())),
    (row, key) => {
      if (key === 'suggested_price') return row.suggested_price ?? 0
      if (key === 'cost_price') return row.cost_price ?? 0
      if (key === 'revenue_value') return (row.current_stock ?? 0) * (row.suggested_price ?? 0)
      if (key === 'stock_value') return (row.current_stock ?? 0) * (row.cost_price ?? 0)
      if (key === 'current_stock') return row.current_stock ?? 0
      return row[key]
    },
  )

  const { page, setPage, pageCount, paged: pagedProducts } = usePagination(filteredProducts)

  const stockValueTotal = filteredProducts.reduce(
    (sum, p) => sum + (p.current_stock ?? 0) * (p.suggested_price ?? 0),
    0,
  )
  const stockCostValueTotal = filteredProducts.reduce(
    (sum, p) => sum + (p.current_stock ?? 0) * (p.cost_price ?? 0),
    0,
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePrintStockOpname}
            disabled={opnamePdfLoading}
          >
            <PrinterIcon />
            {opnamePdfLoading ? 'Generating…' : 'Print Stock Opname'}
          </Button>
          <Button
            onClick={() => {
              setEditingProduct(null)
              setDialogOpen(true)
            }}
          >
            + Add New Product
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {!hideCost && (
          <Card size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground">Revenue Value</p>
              <p className="text-[22px] leading-tight font-semibold tabular-nums break-all">
                {formatRupiah(stockValueTotal)}
              </p>
            </CardContent>
          </Card>
        )}
        {!hideCost && (
          <Card size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground">Cost Value</p>
              <p className="text-[22px] leading-tight font-semibold tabular-nums break-all">
                {formatRupiah(stockCostValueTotal)}
              </p>
            </CardContent>
          </Card>
        )}
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
              active={sortKey === 'current_stock'}
              dir={sortDir}
              onClick={() => toggle('current_stock')}
              className="w-24 text-left"
            >
              Stock
            </SortableTableHead>
            <SortableTableHead
              active={sortKey === 'suggested_price'}
              dir={sortDir}
              onClick={() => toggle('suggested_price')}
              className="w-36 text-left"
            >
              Price / Unit
            </SortableTableHead>
            {!hideCost && (
              <SortableTableHead
                active={sortKey === 'revenue_value'}
                dir={sortDir}
                onClick={() => toggle('revenue_value')}
                className="text-left"
              >
                Revenue Value
              </SortableTableHead>
            )}
            {!hideCost && (
              <SortableTableHead
                active={sortKey === 'cost_price'}
                dir={sortDir}
                onClick={() => toggle('cost_price')}
                className="w-32 text-left"
              >
                Cost
              </SortableTableHead>
            )}
            {!hideCost && (
              <SortableTableHead
                active={sortKey === 'stock_value'}
                dir={sortDir}
                onClick={() => toggle('stock_value')}
                className="text-left"
              >
                Cost Value
              </SortableTableHead>
            )}
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={hideCost ? 5 : 8} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          ) : filteredProducts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={hideCost ? 5 : 8} className="text-center text-muted-foreground">
                {search ? 'No matching products.' : 'No products yet.'}
              </TableCell>
            </TableRow>
          ) : (
            pagedProducts.map((product) => (
              <TableRow key={product.sku_id}>
                <TableCell>{String(product.sku_id).padStart(3, '0')}</TableCell>
                <TableCell>{product.sku_name}</TableCell>
                <TableCell>{product.current_stock != null ? formatQty(product.current_stock) : '-'}</TableCell>
                <TableCell>
                  {product.suggested_price != null
                    ? `${formatRupiah(product.suggested_price)} / ${product.unit}`
                    : `- / ${product.unit}`}
                </TableCell>
                {!hideCost && (
                  <TableCell>
                    {product.current_stock != null && product.suggested_price != null
                      ? formatRupiah(product.current_stock * product.suggested_price)
                      : '-'}
                  </TableCell>
                )}
                {!hideCost && (
                  <TableCell>
                    {product.cost_price != null ? formatRupiah(product.cost_price) : '-'}
                  </TableCell>
                )}
                {!hideCost && (
                  <TableCell>
                    {product.current_stock != null && product.cost_price != null
                      ? formatRupiah(product.current_stock * product.cost_price)
                      : '-'}
                  </TableCell>
                )}
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
                      {!hideCost && (
                        <DropdownMenuItem onClick={() => setHistoryProduct(product)}>
                          History
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setAdjustingProduct(product)}>
                        Adjust Stock
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
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />

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

      <AdjustStockDialog
        open={!!adjustingProduct}
        onOpenChange={(open) => !open && setAdjustingProduct(null)}
        product={adjustingProduct}
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

      <Dialog
        open={opnamePdfLoading || opnamePdfUrl !== null || opnamePdfError !== null}
        onOpenChange={(open) => !open && closeOpnamePdf()}
      >
        <DialogContent className="flex h-[90vh] max-h-[90vh] max-w-3xl flex-col sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Stock Opname</DialogTitle>
          </DialogHeader>
          {opnamePdfLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Generating…</p>
          ) : opnamePdfError ? (
            <p className="py-8 text-center text-sm text-destructive">{opnamePdfError}</p>
          ) : opnamePdfUrl ? (
            <PdfPreviewFrame
              title="Stock Opname"
              url={opnamePdfUrl}
              frameClassName="w-full rounded-md border"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
