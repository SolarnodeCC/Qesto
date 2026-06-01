/**
 * FE native push registration client (NATIVE-PUSH-01, Sprint 81).
 */
import { api } from '../api/client'
import { isNativeShell, nativePlatform } from './native-shell'

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
