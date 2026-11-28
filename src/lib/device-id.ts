// Per-browser device id for live-session voter identity.
//
// The server folds this UUID into the per-session salted voter HMAC
// (functions/api/lib/voter.ts). Without it, participants sharing one public IP
// with identical devices (a classroom of iPhones, a corporate laptop fleet)
// collapsed into a single voter and only the first vote per question counted.
//
// Not a tracking identifier: it is random, never sent anywhere except the
// session WebSocket URL, and the server only ever uses it as HMAC input under a
// per-session key that is destroyed at close.

const STORAGE_KEY = 'qesto:device-id:v1'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

let memoryFallback: string | null = null

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // RFC 4122 v4 from getRandomValues (older Safari).
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Stable per-browser id; falls back to a per-tab id when storage is blocked. */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing && UUID_RE.test(existing)) return existing
    const id = newId()
    localStorage.setItem(STORAGE_KEY, id)
    return id
  } catch {
    // Private mode / blocked storage: stable for this page lifetime only.
    memoryFallback ??= newId()
    return memoryFallback
  }
}
