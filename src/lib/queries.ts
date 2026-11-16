import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  createBusinessAlias,
  deleteBusinessAlias,
  getBusiness,
  listBusinessAliases,
  updateBusiness,
  updateBusinessAlias,
  uploadBusinessAliasLogo,
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
  createNota,
  getNota,
  getNotaDateRange,
  listNota,
  voidNota,
  updateNota,
  type NotaUpdateInput,
  type NotaInput,
} from '@/lib/nota'
import { clearAllNotaPdfCaches, invalidateNotaPdfCache } from '@/lib/notaPdf'
import { clearPaymentPdfCache } from '@/lib/paymentPdf'
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  type CreateProductInput,
  type ProductInput,
} from '@/lib/products'
import {
  createUser,
  deactivateUser,
  listUsers,
  resetUserPassword,
  updateUserRole,
  type AssignableRole,
  type CreateUserInput,
} from '@/lib/users'
import {
  createStockMovement,
  deleteStockMovement,
  listStockLedger,
  updateStockMovement,
  type StockMovementInput,
  type StockMovementUpdateInput,
} from '@/lib/stockLedger'
import {
  createRawMaterial,
  createRawMaterialMovement,
  deleteRawMaterial,
  deleteRawMaterialMovement,
  listRawMaterialLedger,
  listRawMaterials,
  updateRawMaterial,
  updateRawMaterialMovement,
  type CreateRawMaterialInput,
  type RawMaterialInput,
  type RawMaterialMovementInput,
  type RawMaterialMovementUpdateInput,
} from '@/lib/rawMaterial'
import { listVendors } from '@/lib/vendors'
import { createPurchaseOrder, type PurchaseOrderInput } from '@/lib/purchaseOrders'

// Logo or business details changed — every cached PDF (client-side and the
// server-side R2 nota cache) has the old letterhead baked in.
function invalidateAllPdfCaches() {
  invalidateLogoCache()
  clearAllNotaPdfCaches()
  clearBillPdfCache()
  clearPaymentPdfCache()
}

// Switching the Business Settings staging toggle swaps every DB-backed
// response out from under the cache, so drop everything and let the
// currently mounted pages refetch against the newly selected database.
export function resetAllCachesForDbSwitch(queryClient: QueryClient) {
  queryClient.clear()
  invalidateAllPdfCaches()
}

// Centralized query keys so invalidation ("nota changed, refetch every nota
// list regardless of filters") stays correct without components having to
// know each other's exact key shape.
export const queryKeys = {
  business: ['business'] as const,
  businessAliases: ['business', 'aliases'] as const,
  customers: ['customers'] as const,
  products: ['products'] as const,
  stockLedger: ['stock-ledger'] as const,
  rawMaterials: ['raw-materials'] as const,
  rawMaterialLedger: ['raw-material-ledger'] as const,
  vendors: ['vendors'] as const,
  users: ['users'] as const,
  notaList: (params?: Record<string, unknown>) => ['nota', 'list', params ?? {}] as const,
  notaDetail: (notaId: number) => ['nota', 'detail', notaId] as const,
  notaDateRange: ['nota', 'date-range'] as const,
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

export function useBusinessAliasesQuery() {
  return useQuery({ queryKey: queryKeys.businessAliases, queryFn: listBusinessAliases })
}

export function useCreateBusinessAliasMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: BusinessInput) => createBusinessAlias(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businessAliases })
    },
  })
}

export function useUpdateBusinessAliasMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ businessId, input }: { businessId: number; input: BusinessInput }) =>
      updateBusinessAlias(businessId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businessAliases })
    },
  })
}

export function useDeleteBusinessAliasMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (businessId: number) => deleteBusinessAlias(businessId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businessAliases })
    },
  })
}

export function useUploadBusinessAliasLogoMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ businessId, blob }: { businessId: number; blob: Blob }) =>
      uploadBusinessAliasLogo(businessId, blob),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businessAliases })
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

// --- Stock ledger -------------------------------------------------------

export function useStockLedgerQuery() {
  return useQuery({ queryKey: queryKeys.stockLedger, queryFn: listStockLedger })
}

export function useCreateStockMovementMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: StockMovementInput) => createStockMovement(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stockLedger })
      queryClient.invalidateQueries({ queryKey: queryKeys.products })
    },
  })
}

export function useUpdateStockMovementMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: StockMovementUpdateInput }) => updateStockMovement(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stockLedger })
      queryClient.invalidateQueries({ queryKey: queryKeys.products })
    },
  })
}

export function useDeleteStockMovementMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteStockMovement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stockLedger })
      queryClient.invalidateQueries({ queryKey: queryKeys.products })
    },
  })
}

export function useCreateProductMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProductInput) => createProduct(input),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products })
      // Deleting a product cascades to deactivate its stock_ledger rows
      // (DB trigger) -- refetch so they disappear from Stock Management too.
      queryClient.invalidateQueries({ queryKey: queryKeys.stockLedger })
    },
  })
}

// --- Raw materials -------------------------------------------------------

export function useRawMaterialsQuery() {
  return useQuery({ queryKey: queryKeys.rawMaterials, queryFn: listRawMaterials })
}

export function useCreateRawMaterialMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateRawMaterialInput) => createRawMaterial(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rawMaterials })
      // Creation also writes an initial_stock ledger row (with optional
      // price) -- refetch so Unit Price / Raw Mat. Value rehydrate too.
      queryClient.invalidateQueries({ queryKey: queryKeys.rawMaterialLedger })
    },
  })
}

export function useUpdateRawMaterialMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ rawMatId, input }: { rawMatId: number; input: RawMaterialInput }) =>
      updateRawMaterial(rawMatId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.rawMaterials }),
  })
}

export function useDeleteRawMaterialMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (rawMatId: number) => deleteRawMaterial(rawMatId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rawMaterials })
      // Deleting a raw material cascades to deactivate its ledger rows
      // (DB trigger) -- refetch so they disappear from Raw Mat. Management too.
      queryClient.invalidateQueries({ queryKey: queryKeys.rawMaterialLedger })
    },
  })
}

// --- Raw material ledger --------------------------------------------------

export function useRawMaterialLedgerQuery() {
  return useQuery({ queryKey: queryKeys.rawMaterialLedger, queryFn: listRawMaterialLedger })
}

export function useCreateRawMaterialMovementMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RawMaterialMovementInput) => createRawMaterialMovement(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rawMaterialLedger })
      queryClient.invalidateQueries({ queryKey: queryKeys.rawMaterials })
    },
  })
}

export function useUpdateRawMaterialMovementMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: RawMaterialMovementUpdateInput }) =>
      updateRawMaterialMovement(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rawMaterialLedger })
      queryClient.invalidateQueries({ queryKey: queryKeys.rawMaterials })
    },
  })
}

export function useDeleteRawMaterialMovementMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteRawMaterialMovement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rawMaterialLedger })
      queryClient.invalidateQueries({ queryKey: queryKeys.rawMaterials })
    },
  })
}

// --- Vendors / Purchase orders ---------------------------------------------

export function useVendorsQuery() {
  return useQuery({ queryKey: queryKeys.vendors, queryFn: listVendors })
}

export function useCreatePurchaseOrderMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PurchaseOrderInput) => createPurchaseOrder(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rawMaterialLedger })
      queryClient.invalidateQueries({ queryKey: queryKeys.rawMaterials })
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors })
    },
  })
}

// --- Users (Team Settings) -----------------------------------------------

export function useUsersQuery() {
  return useQuery({ queryKey: queryKeys.users, queryFn: listUsers })
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  })
}

export function useUpdateUserRoleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AssignableRole }) => updateUserRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  })
}

export function useResetUserPasswordMutation() {
  return useMutation({
    mutationFn: (userId: string) => resetUserPassword(userId),
  })
}

export function useDeactivateUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => deactivateUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  })
}

// --- Nota ---------------------------------------------------------

export function useNotaListQuery(params?: {
  limit?: number
  offset?: number
  q?: string
  status?: string
  startDate?: string
  endDate?: string
}) {
  return useQuery({
    queryKey: queryKeys.notaList(params),
    queryFn: () => listNota(params),
  })
}

export function useNotaDateRangeQuery() {
  return useQuery({ queryKey: queryKeys.notaDateRange, queryFn: getNotaDateRange })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.notaDateRange })
      queryClient.invalidateQueries({ queryKey: queryKeys.products })
      queryClient.invalidateQueries({ queryKey: queryKeys.customers })
    },
  })
}

export function useUpdateNotaMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ notaId, input }: { notaId: number; input: NotaUpdateInput }) =>
      updateNota(notaId, input),
    onSuccess: (_data, { notaId }) => {
      queryClient.invalidateQueries({ queryKey: ['nota', 'list'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.notaDetail(notaId) })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.notaDateRange })
      invalidateNotaPdfCache(notaId)
    },
  })
}

