import { QueryClient } from '@tanstack/react-query'

// Shared cache for every list/get call in the app — replaces the old
// pattern of each component independently useEffect+fetching the same data
// (getBusiness alone had 11 call sites). Components that read the same
// query key share one in-flight request and one cached result.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Business/customers/products change rarely (settings pages, manual
      // CRUD) — avoid refetching on every tab focus or remount.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
