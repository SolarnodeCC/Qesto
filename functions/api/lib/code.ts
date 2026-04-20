// 6-char join code (Crockford base32, minus confusables I/L/O/U).
// Stored in sessions.code and used at /j/:code by voters in Phase 3.
// Collision probability with 28-char alphabet over 6 chars is ~1/5e8 per pair —
// retry logic in the route handles the UNIQUE constraint violation if it ever
// lands.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function generateJoinCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  let out = ''
  for (let i = 0; i < 6; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}
