// ULID-like identifier: 26-char Crockford Base32, sortable by creation time.
// We keep it dependency-free; the 80-bit random component is derived from
// crypto.getRandomValues so collision risk is negligible for v1.

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function ulid(nowMs: number = Date.now()): string {
  return encodeTime(nowMs) + encodeRandom()
}

function encodeTime(ms: number): string {
  let t = ms
  const out = new Array<string>(10)
  for (let i = 9; i >= 0; i--) {
    out[i] = ENCODING[t % 32]!
    t = Math.floor(t / 32)
  }
  return out.join('')
}

function encodeRandom(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < 16; i++) out += ENCODING[bytes[i]! % 32]
  return out
}
