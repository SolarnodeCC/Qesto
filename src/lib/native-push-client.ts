/**
 * FE native push registration client (NATIVE-PUSH-01, Sprint 81).
 *
 * NATIVE-GA-01 (Sprint 82) store-readiness: the Capacitor shell requests push
 * permission on launch and, once the OS returns an FCM/APNs token, hands it to
 * the web layer. We accept that token via either a pre-boot global
 * (`window.__qestoNativePushToken`, set before the bundle loads) or a runtime
 * `qesto:native-push-token` CustomEvent, then register it with the backend.
 * `initNativePush()` is a no-op outside the native shell, so it is safe to call
 * unconditionally on app init.
 */
import { api } from '../api/client'
import { isNativeShell, nativePlatform } from './native-shell'

declare global {
  interface Window {
    __qestoNativePushToken?: { token?: string; appVersion?: string }
  }
}

export type NativePushTokenDetail = { token?: string; appVersion?: string }

export type NativePushStatus = {
  nativePushEnabled: boolean
  platforms: string[]
  delivery: string
}

export async function fetchNativePushStatus(): Promise<NativePushStatus | null> {
  const res = await api<{ data: NativePushStatus }>('/api/native/push/status')
  if (!res.ok || !res.data.data) return null
  return res.data.data
}

export async function registerNativeDeviceToken(
  token: string,
  opts?: { appVersion?: string; locale?: string },
): Promise<boolean> {
  if (!isNativeShell()) return false
  const platform = nativePlatform()
  if (platform === 'web') return false

  const res = await api<{ data: { id: string } }>('/api/native/push/tokens', {
    method: 'POST',
    body: {
      platform,
      token,
      appVersion: opts?.appVersion,
      locale: opts?.locale ?? navigator.language?.slice(0, 16),
    },
  })
  return res.ok
}

let _nativePushInitialised = false

/**
 * Wire native push registration on shell init (NATIVE-GA-01). Idempotent and a
 * no-op in the browser/PWA. Registers a token supplied either before boot
 * (`window.__qestoNativePushToken`) or at runtime via `qesto:native-push-token`.
 */
export function initNativePush(): void {
  if (_nativePushInitialised) return
  if (typeof window === 'undefined' || !isNativeShell()) return
  _nativePushInitialised = true

  window.addEventListener('qesto:native-push-token', (event) => {
    const detail = (event as CustomEvent<NativePushTokenDetail>).detail
    if (detail?.token) {
      void registerNativeDeviceToken(detail.token, detail.appVersion ? { appVersion: detail.appVersion } : undefined)
    }
  })

  const pending = window.__qestoNativePushToken
  if (pending?.token) {
    void registerNativeDeviceToken(pending.token, pending.appVersion ? { appVersion: pending.appVersion } : undefined)
  }
}
