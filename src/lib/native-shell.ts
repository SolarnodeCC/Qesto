/**
 * NATIVE-SHELL-01 — detect Capacitor native shell vs browser PWA (Sprint 81).
 */

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean
      getPlatform?: () => string
    }
  }
}

export function isNativeShell(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.Capacitor?.isNativePlatform?.() === true
  } catch {
    return false
  }
}

export function nativePlatform(): 'ios' | 'android' | 'web' {
  if (!isNativeShell()) return 'web'
  const p = window.Capacitor?.getPlatform?.()
  if (p === 'ios' || p === 'android') return p
  return 'web'
}

/** CSS env(safe-area-inset-*) helper class for shell chrome. */
export function nativeSafeAreaClass(): string {
  return isNativeShell() ? 'native-safe-area' : ''
}
