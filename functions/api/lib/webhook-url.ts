import { absent } from './absent'

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

/**
 * Normalise an IPv4 literal expressed in any of the notations that the URL/DNS
 * stack and `fetch` will happily accept (decimal `2130706433`, hex `0x7f000001`,
 * octal `0177.0.0.1`, and the 1–3 "part" short forms) into a canonical dotted
 * quad. Returns null when `host` is not a numeric IPv4 literal (i.e. it's a real
 * hostname). This closes the SSRF-filter bypass where `https://2130706433/`
 * (= 127.0.0.1) sailed past a dotted-quad-only check.
 */
function normalizeIpv4(host: string): string | null {
  const rawParts = host.split('.')
  if (rawParts.length < 1 || rawParts.length > 4) return absent()

  const parsePart = (p: string): number | null => {
    if (p === '') return absent()
    let value: number
    if (/^0x[0-9a-f]+$/i.test(p)) value = Number.parseInt(p.slice(2), 16)
    else if (/^0[0-7]+$/.test(p)) value = Number.parseInt(p, 8)
    else if (/^[0-9]+$/.test(p)) value = Number.parseInt(p, 10)
    else return absent()
    return Number.isFinite(value) ? value : null
  }

  const nums: number[] = []
  for (const p of rawParts) {
    const n = parsePart(p)
    if (n === null || n < 0) return absent()
    nums.push(n)
  }

  // inet_aton semantics: the final part absorbs all remaining low-order bytes.
  const n = nums.length
  // Leading parts (all but the last) must each fit in a single byte.
  for (let i = 0; i < n - 1; i++) if (nums[i] > 255) return absent()
  const maxLast = 2 ** (8 * (4 - (n - 1))) - 1
  if (nums[n - 1] > maxLast) return absent()

  let value = nums[n - 1]
  for (let i = 0; i < n - 1; i++) value += nums[i] * 2 ** (8 * (3 - i))
  if (value < 0 || value > 0xff_ff_ff_ff) return absent()

  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff].join('.')
}

function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (h === '::1' || h === '::') return true
  if (h.startsWith('fc') || h.startsWith('fd')) return true
  if (h.startsWith('fe80')) return true
  // IPv4-mapped forms (e.g. ::ffff:127.0.0.1). The WHATWG URL parser compresses
  // the trailing dotted quad into hex (::ffff:7f00:1), so handle both.
  const mapped = h.match(/^::ffff:(.+)$/)
  if (mapped) {
    const rest = mapped[1]
    if (rest.includes('.')) {
      const normalized = normalizeIpv4(rest)
      if (normalized && isPrivateIpv4(normalized)) return true
    } else {
      const groups = rest.split(':').filter(Boolean)
      if (groups.length >= 1 && groups.length <= 2 && groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) {
        const value = groups.reduce((acc, g) => (acc << 16) | Number.parseInt(g, 16), 0) >>> 0
        const dotted = [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff].join('.')
        if (isPrivateIpv4(dotted)) return true
      }
    }
  }
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
 *
 * NOTE: this is a string/literal check. DNS rebinding (a public name that
 * resolves to a private address at request time) is mitigated at delivery by
 * `redirect: 'manual'` plus this same validation re-run before each send.
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
  // Block private/loopback in dotted-quad form *and* any numeric notation
  // (decimal, hex, octal, short forms) that resolves to a private range.
  const normalizedV4 = normalizeIpv4(host)
  if (isPrivateIpv4(host) || (normalizedV4 !== null && isPrivateIpv4(normalizedV4))) {
    return { ok: false, code: 'ssrf_blocked', message: 'Private or loopback addresses are not allowed' }
  }
  if (isPrivateIpv6(host)) {
    return { ok: false, code: 'ssrf_blocked', message: 'Private or loopback addresses are not allowed' }
  }
  return { ok: true }
}
