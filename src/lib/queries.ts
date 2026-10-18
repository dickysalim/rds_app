import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getBusiness,
  updateBusiness,
  uploadBusinessLogo,
  type Business,
  type BusinessInput,
} from '@/lib/business'
import { clearBillPdfCache } from '@/lib/billPdf'
import {
  createCustomer,
  deleteCustomer,
  listCustomers,
  updateCustomer,
  type CustomerInput,
} from '@/lib/customers'
import { invalidateLogoCache } from '@/lib/logoCache'
import {
  createBillPayment,
  createNota,
  getNota,
  listBillPayments,
  listNota,
  voidNota,
  type NotaInput,
  type PaymentInput,
} from '@/lib/nota'
import { clearAllNotaPdfCaches, invalidateNotaPdfCache } from '@/lib/notaPdf'
import { clearPaymentPdfCache } from '@/lib/paymentPdf'
import { createProduct, deleteProduct, listProducts, updateProduct, type ProductInput } from '@/lib/products'

// Logo or business details changed — every cached PDF (client-side and the
// server-side R2 nota cache) has the old letterhead baked in.
function invalidateAllPdfCaches() {
  invalidateLogoCache()
  clearAllNotaPdfCaches()
  clearBillPdfCache()
  clearPaymentPdfCache()
}

// Centralized query keys so invalidation ("nota changed, refetch every nota
// list regardless of filters") stays correct without components having to
// know each other's exact key shape.
export const queryKeys = {
  business: ['business'] as const,
  customers: ['customers'] as const,
  products: ['products'] as const,
  notaList: (params?: Record<string, unknown>) => ['nota', 'list', params ?? {}] as const,
  notaDetail: (notaId: number) => ['nota', 'detail', notaId] as const,
  payments: (customerId: number, year: number, month: number) =>
    ['bill-payments', customerId, year, month] as const,
}

// --- Business ---------------------------------------------------------

export function useBusinessQuery() {
  return useQuery({ queryKey: queryKeys.business, queryFn: getBusiness })
}

export function useUpdateBusinessMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: BusinessInput) => updateBusiness(input),
    onSuccess: (business: Business) => {
      queryClient.setQueryData(queryKeys.business, business)
      invalidateAllPdfCaches()
    },
  })
}

export function useUploadBusinessLogoMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (blob: Blob) => uploadBusinessLogo(blob),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.business })
      invalidateAllPdfCaches()
    },
  })
}

// --- Customers ---------------------------------------------------------

export function useCustomersQuery() {
  return useQuery({ queryKey: queryKeys.customers, queryFn: listCustomers })
}

export function useCreateCustomerMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CustomerInput) => createCustomer(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers }),
  })
}

export function useUpdateCustomerMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ customerId, input }: { customerId: number; input: CustomerInput }) =>
      updateCustomer(customerId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers }),
  })
}

export function useDeleteCustomerMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (customerId: number) => deleteCustomer(customerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers }),
  })
}

// --- Products ---------------------------------------------------------

export function useProductsQuery() {
  return useQuery({ queryKey: queryKeys.products, queryFn: listProducts })
}

export function useCreateProductMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProductInput) => createProduct(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.products }),
  })
}

export function useUpdateProductMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ skuId, input }: { skuId: number; input: ProductInput }) =>
      updateProduct(skuId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.products }),
  })
}

export function useDeleteProductMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (skuId: number) => deleteProduct(skuId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.products }),
  })
}

// --- Nota ---------------------------------------------------------

export function useNotaListQuery(params?: {
  limit?: number
  offset?: number
  q?: string
  status?: string
  year?: string
  month?: string
}) {
  return useQuery({
    queryKey: queryKeys.notaList(params),
    queryFn: () => listNota(params),
  })
}

export function useNotaDetailQuery(notaId: number | null) {
  return useQuery({
    queryKey: queryKeys.notaDetail(notaId ?? -1),
    queryFn: () => getNota(notaId as number),
    enabled: notaId !== null,
  })
}

export function useCreateNotaMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NotaInput) => createNota(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nota', 'list'] })
    },
  })
}

export function useVoidNotaMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notaId: number) => voidNota(notaId),
    onSuccess: (_data, notaId) => {
      queryClient.invalidateQueries({ queryKey: ['nota', 'list'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.notaDetail(notaId) })
      invalidateNotaPdfCache(notaId)
    },
  })
}

// --- Payments ---------------------------------------------------------
// A payment belongs to the bill (customer + month), not a single nota.

export function usePaymentsQuery(customerId: number | null, year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.payments(customerId ?? -1, year, month),
    queryFn: () => listBillPayments(customerId as number, year, month),
    enabled: customerId !== null,
  })
}

export function useCreatePaymentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ customerId, input }: { customerId: number; input: PaymentInput }) =>
      createBillPayment(customerId, input),
    onSuccess: (_data, { customerId, input }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments(customerId, input.year, input.month) })
      queryClient.invalidateQueries({ queryKey: ['nota', 'list'] })
    },
  })
}
