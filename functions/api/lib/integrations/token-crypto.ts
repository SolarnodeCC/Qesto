import { absent } from '../absent'
/**
 * AES-GCM helpers for integration OAuth tokens (INT-PROVIDER-01).
 * Master key: OAUTH_TOKEN_MEK secret (SHA-256 derived to 256-bit AES key).
 */

import { z } from 'zod'
const ENVELOPE_VERSION = 1

export type TokenEnvelope = {
  v: typeof ENVELOPE_VERSION
  iv: string
  ct: string
}

const TokenEnvelopeSchema = z.object({
  v: z.literal(ENVELOPE_VERSION),
  iv: z.string().min(1),
  ct: z.string().min(1),
})

export async function deriveAesKeyFromMek(mek: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(mek)
  const hash = await crypto.subtle.digest('SHA-256', raw)
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export async function encryptTokenPayload(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  const envelope: TokenEnvelope = {
    v: ENVELOPE_VERSION,
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(cipher)),
  }
  return JSON.stringify(envelope)
}

export async function decryptTokenPayload(serialized: string, key: CryptoKey): Promise<string | null> {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return absent()
  }
  const envelope = TokenEnvelopeSchema.safeParse(parsed)
  if (!envelope.success) return absent()
  const { iv, ct } = envelope.data
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(iv) as BufferSource },
      key,
      base64ToBytes(ct) as BufferSource,
    )
    return new TextDecoder().decode(plain)
  } catch {
    return absent()
  }
}

export function isLegacyPlaintextTokenBlob(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return false
    const obj = parsed as { access_token?: unknown; v?: unknown }
    return typeof obj.access_token === 'string' && obj.v === undefined
  } catch {
    return false
  }
}
