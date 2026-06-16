import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

const STORAGE_KEY = 'privacyHidden'

type PrivacyContextValue = {
  hidden: boolean
  toggle: () => void
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null)

export function PrivacyProvider({ children }: { children: ReactNode }) {
  // Por defecto oculto (ojo cerrado), salvo que el usuario ya lo haya abierto antes
  const [hidden, setHidden] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'false')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(hidden))
  }, [hidden])

  return (
    <PrivacyContext.Provider value={{ hidden, toggle: () => setHidden(h => !h) }}>
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext)
  if (!ctx) throw new Error('usePrivacy debe usarse dentro de PrivacyProvider')
  return ctx
}
