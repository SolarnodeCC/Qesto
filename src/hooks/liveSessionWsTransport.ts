import { API_BASE_URL } from '../config/api'

/** Build `/api/sessions/:id/ws` URL with optional voter fingerprint query param. */
export function buildLiveSessionWsUrl(sessionId: string, fingerprint?: string): string {
  const wsBase = API_BASE_URL
    ? API_BASE_URL.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
    : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
  return `${wsBase}/api/sessions/${encodeURIComponent(sessionId)}/ws${
    fingerprint ? `?fp=${encodeURIComponent(fingerprint)}` : ''
  }`
}

/** Send a JSON frame when the socket is OPEN. */
export function sendWsJson(ws: WebSocket | null, payload: Record<string, unknown>): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false
  ws.send(JSON.stringify(payload))
  return true
}
