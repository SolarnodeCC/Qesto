import { createContext, useContext, type ReactNode } from 'react'
import { useColorScheme, type ColorSchemePreference, type ResolvedColorScheme } from './useColorScheme'

type ColorSchemeContextValue = {
  preference: ColorSchemePreference
  scheme: ResolvedColorScheme
  setPreference: (p: ColorSchemePreference) => void
  toggle: () => void
}

const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null)

export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const value = useColorScheme()
  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>
}

export function useColorSchemeContext(): ColorSchemeContextValue {
  const ctx = useContext(ColorSchemeContext)
  if (!ctx) throw new Error('useColorSchemeContext must be used within ColorSchemeProvider')
  return ctx
}
