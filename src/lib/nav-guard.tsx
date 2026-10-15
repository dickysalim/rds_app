import { createContext, useContext, useRef } from 'react'

type Guard = (proceed: () => void) => void

interface NavGuardValue {
  guardRef: React.MutableRefObject<Guard | null>
}

const NavGuardContext = createContext<NavGuardValue | null>(null)

export function NavGuardProvider({ children }: { children: React.ReactNode }) {
  const guardRef = useRef<Guard | null>(null)
  return <NavGuardContext.Provider value={{ guardRef }}>{children}</NavGuardContext.Provider>
}

export function useNavGuard(): NavGuardValue {
  const ctx = useContext(NavGuardContext)
  if (!ctx) throw new Error('useNavGuard must be used within NavGuardProvider')
  return ctx
}
