/**
 * useWebXrSupport.ts — real WebXR device-capability detection (ADR-0066 D5,
 * FE-XR-LAUNCHER-01).
 *
 * This hook resolves the **capability gate** (gate 2 of the two-gate launcher
 * contract). The **flag/feature gate** (gate 1 — `'xr'` in
 * `init.data.features[]`) stays in `JoinPage.tsx`/the DO and is unchanged by
 * this file. The launcher button still only renders when the DO advertises
 * `'xr'`; this hook only changes what the button *says* and whether the
 * opt-in flow goes to the immersive overlay or makes clear it's the standard
 * 2D preview.
 *
 * Detection is intentionally conservative: any environment where
 * `navigator.xr` is undefined (SSR, jsdom/non-browser test runners, desktop
 * browsers without the WebXR Device API) resolves to `'unsupported'` rather
 * than throwing or hanging. `isSessionSupported('immersive-vr')` is the
 * primary probe (Quest 3); `'immersive-ar'` is a secondary probe for handheld
 * AR (iOS Safari 16+/Android Chrome), per ADR-0066 D5.
 */
import { useEffect, useState } from 'react'

export type WebXrSupport = 'checking' | 'supported' | 'unsupported'

interface NavigatorXr {
  isSessionSupported?: (mode: 'immersive-vr' | 'immersive-ar' | 'inline') => Promise<boolean>
}

function getNavigatorXr(): NavigatorXr | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as Navigator & { xr?: NavigatorXr }).xr
}

/**
 * Resolves WebXR session-support for the current device/browser.
 *
 * Returns `'checking'` until the async probe settles, then `'supported'` or
 * `'unsupported'`. Never throws — any missing API, rejected promise, or
 * non-browser environment resolves to `'unsupported'` so the launcher always
 * has a safe, renderable fallback state (ADR-0066: XR is opt-in, never a
 * gate).
 */
export async function detectWebXrSupport(): Promise<boolean> {
  const xr = getNavigatorXr()
  if (!xr || typeof xr.isSessionSupported !== 'function') return false
  try {
    const immersiveVr = await xr.isSessionSupported('immersive-vr')
    if (immersiveVr) return true
    // Secondary probe for handheld AR (iOS Safari 16+/Android Chrome) per
    // ADR-0066 D5 — devices without a VR headset can still support AR.
    const immersiveAr = await xr.isSessionSupported('immersive-ar')
    return Boolean(immersiveAr)
  } catch {
    return false
  }
}

/** React hook wrapping {@link detectWebXrSupport} with cancellation-safe state. */
export function useWebXrSupport(): WebXrSupport {
  const [support, setSupport] = useState<WebXrSupport>('checking')

  useEffect(() => {
    let cancelled = false
    detectWebXrSupport()
      .then((isSupported) => {
        if (!cancelled) setSupport(isSupported ? 'supported' : 'unsupported')
      })
      .catch(() => {
        if (!cancelled) setSupport('unsupported')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return support
}
