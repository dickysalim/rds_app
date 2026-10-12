import { MoreHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProductDialog } from '@/components/ProductDialog'
import { formatRupiah } from '@/lib/currency'
import { deleteProduct, listProducts, type Product } from '@/lib/products'

export function ProductPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    listProducts()
      .then(setProducts)
      .finally(() => setLoading(false))
  }, [])

  function handleSaved(product: Product) {
    setProducts((prev) => {
      const exists = prev.some((p) => p.sku_id === product.sku_id)
      return exists ? prev.map((p) => (p.sku_id === product.sku_id ? product : p)) : [...prev, product]
    })
  }

  async function handleDelete() {
    if (!deletingProduct) return
    setDeleting(true)
    try {
      await deleteProduct(deletingProduct.sku_id)
      setProducts((prev) => prev.filter((p) => p.sku_id !== deletingProduct.sku_id))
      setDeletingProduct(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Product</h1>
        <Button
          onClick={() => {
            setEditingProduct(null)
            setDialogOpen(true)
          }}
        >
          + Add New Product
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU ID</TableHead>
            <TableHead>SKU Name</TableHead>
            <TableHead className="text-right">Suggested Price</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          ) : products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No products yet.
              </TableCell>
            </TableRow>
          ) : (
            products.map((product) => (
              <TableRow key={product.sku_id}>
                <TableCell>{product.sku_id}</TableCell>
                <TableCell>{product.sku_name}</TableCell>
                <TableCell className="text-right">
                  {product.suggested_price != null ? formatRupiah(product.suggested_price) : '-'}
                </TableCell>
                <TableCell>{product.unit}</TableCell>
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

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editingProduct}
        onSaved={handleSaved}
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
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
