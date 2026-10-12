import { useEffect, useState } from 'react'
import { AddProductDialog } from '@/components/AddProductDialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatRupiah } from '@/lib/currency'
import { listProducts, type Product } from '@/lib/products'

export function ProductPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listProducts()
      .then(setProducts)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Product</h1>
        <AddProductDialog onCreated={(product) => setProducts((prev) => [...prev, product])} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU Name</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="text-right">Suggested Price</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          ) : products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No products yet.
              </TableCell>
            </TableRow>
          ) : (
            products.map((product) => (
              <TableRow key={product.sku_id}>
                <TableCell>{product.sku_name}</TableCell>
                <TableCell>{product.unit}</TableCell>
                <TableCell className="text-right">
                  {product.suggested_price != null ? formatRupiah(product.suggested_price) : '-'}
                </TableCell>
                <TableCell>{product.is_active ? 'Active' : 'Inactive'}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
