// PBKDF2-SHA256 password hashing via WebCrypto.
// Runs natively on Cloudflare Workers and Node 20+ (Vitest).
//
// Current format: `pbkdf2$<iterations>$<saltHex>$<hashHex>` (16-byte salt,
//   32-byte key). The iteration count is embedded so the work factor can be
//   raised over time and verified hashes self-describe their cost.
// Legacy format:  `<saltHex>:<hashHex>` — implicit 100k iterations. Still
//   verifiable; `passwordNeedsRehash` flags these for upgrade-on-login.

import { timingSafeEqual } from './shared/crypto'

// OWASP (2023) minimum for PBKDF2-HMAC-SHA256.
const ITERATIONS = 600_000
const LEGACY_ITERATIONS = 100_000
const KEY_LENGTH = 256 // bits
const SALT_BYTES = 16

function toHex(buf: Uint8Array): string {
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH,
  )
  return new Uint8Array(bits)
}

type ParsedHash = { iterations: number; saltHex: string; hashHex: string }

function parseStored(stored: string): ParsedHash | null {
  if (stored.startsWith('pbkdf2$')) {
    const [, iterStr, saltHex, hashHex] = stored.split('$')
    const iterations = Number.parseInt(iterStr ?? '', 10)
    if (!Number.isFinite(iterations) || iterations <= 0 || !saltHex || !hashHex) return null
    return { iterations, saltHex, hashHex }
  }
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return null
  return { iterations: LEGACY_ITERATIONS, saltHex, hashHex }
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await pbkdf2(plain, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(hash)}`
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parsed = parseStored(stored)
  if (!parsed) return false
  const salt = fromHex(parsed.saltHex)
  const hash = await pbkdf2(plain, salt, parsed.iterations)
  return timingSafeEqual(toHex(hash), parsed.hashHex)
}

/**
 * True when a stored hash uses a weaker work factor than the current target
 * (legacy 100k format, or any embedded count below ITERATIONS). Callers should
 * transparently re-hash on the next successful login.
 */
export function passwordNeedsRehash(stored: string): boolean {
  const parsed = parseStored(stored)
  if (!parsed) return false
  return parsed.iterations < ITERATIONS
}
