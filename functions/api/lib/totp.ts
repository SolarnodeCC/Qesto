/**
 * TOTP (RFC 6238 over RFC 4226 HOTP, HMAC-SHA1, 30s step, 6 digits) — the
 * algorithm every authenticator app implements. WebCrypto only, no dependency
 * (DD-04, issue #877).
 */
import { timingSafeEqual } from './shared/crypto'

export const TOTP_STEP_SECONDS = 30
export const TOTP_DIGITS = 6
/** Accept one step either side (±30s clock skew), the common interoperable window. */
export const TOTP_DRIFT_STEPS = 1

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = B32.indexOf(ch)
    if (idx === -1) throw new Error('invalid base32')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

/** 20 random bytes (160 bits, the RFC 4226 recommended secret length), base32. */
export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  return base32Encode(bytes)
}

export async function hotp(secret: Uint8Array, counter: number, digits = TOTP_DIGITS): Promise<string> {
  const key = await crypto.subtle.importKey('raw', secret as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, [
    'sign',
  ])
  const msg = new DataView(new ArrayBuffer(8))
  msg.setBigUint64(0, BigInt(counter))
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg.buffer))
  const off = mac[mac.length - 1]! & 0x0f
  const bin =
    ((mac[off]! & 0x7f) << 24) | (mac[off + 1]! << 16) | (mac[off + 2]! << 8) | mac[off + 3]!
  return String(bin % 10 ** digits).padStart(digits, '0')
}

export function totpStep(nowMs: number): number {
  return Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS)
}

/**
 * Verify a code. Returns the matched step (for replay protection — callers
 * must reject any step <= the last accepted one) or null.
 */
export async function verifyTotp(secretB32: string, code: string, nowMs = Date.now()): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null
  let secret: Uint8Array
  try {
    secret = base32Decode(secretB32)
  } catch {
    return null
  }
  const current = totpStep(nowMs)
  for (let drift = -TOTP_DRIFT_STEPS; drift <= TOTP_DRIFT_STEPS; drift++) {
    const step = current + drift
    if (timingSafeEqual(await hotp(secret, step), code)) return step
  }
  return null
}

/** otpauth:// URI for QR enrolment (Key Uri Format). */
export function otpauthUri(secretB32: string, accountEmail: string, issuer = 'Qesto'): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`)
  const params = new URLSearchParams({
    secret: secretB32,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}
