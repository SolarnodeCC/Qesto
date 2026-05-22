// WEBHOOK-01 — SSRF controls for outbound webhook targets.

export type WebhookUrlValidation =
  | { ok: true }
  | { ok: false; code: 'invalid_url' | 'ssrf_blocked'; message: string }

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map((p) => Number.parseInt(p, 10))
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false
  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase()
  if (h === '::1' || h === '::') return true
  if (h.startsWith('fc') || h.startsWith('fd')) return true
  if (h.startsWith('fe80')) return true
  return false
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
])

/**
 * Reject webhook URLs that could reach private networks or loopback (SSRF).
 * HTTPS-only is enforced separately at the route schema layer.
 */
export function validateWebhookTargetUrl(raw: string): WebhookUrlValidation {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { ok: false, code: 'invalid_url', message: 'URL is not valid' }
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, code: 'invalid_url', message: 'URL must use https://' }
  }
  const host = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, code: 'ssrf_blocked', message: 'URL hostname is not allowed' }
  }
  if (host.endsWith('.localhost') || host.endsWith('.local')) {
    return { ok: false, code: 'ssrf_blocked', message: 'URL hostname is not allowed' }
  }
  if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
    return { ok: false, code: 'ssrf_blocked', message: 'Private or loopback addresses are not allowed' }
  }
  return { ok: true }
}
