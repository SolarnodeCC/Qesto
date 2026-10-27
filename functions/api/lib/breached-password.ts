/**
 * Breached-credential screening for NEW passwords (DD-36, issue #908;
 * NIST SP 800-63B §5.1.1.2).
 *
 * Applied on signup and password-reset confirm only — never on login, so an
 * existing user is never locked out mid-session by a list update.
 *
 * Two layers:
 *   1. A bundled denylist of the most common passwords (always on, offline).
 *   2. Have I Been Pwned range lookup when `BREACHED_PASSWORD_CHECK = "hibp"`.
 *      k-anonymity: only the first 5 hex chars of the SHA-1 leave the Worker,
 *      with `Add-Padding` so response size does not leak the prefix's bucket.
 *      The password itself is never transmitted. Fails OPEN on timeout/error —
 *      availability of signup outranks strictness here, and layer 1 still holds.
 */
import { logExternalFailure } from './log'

export const BREACHED_PASSWORD_MESSAGE =
  'This password has appeared in a data breach. Choose a different one.'

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/'
const HIBP_TIMEOUT_MS = 2000

// Most common breached passwords of length >= 8 (the schema minimum).
// Compared case-insensitively.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234', 'passw0rd', 'p@ssw0rd', 'p@ssword',
  '12345678', '123456789', '1234567890', '0123456789', '87654321', '11111111', '00000000', '88888888',
  '12341234', '12121212', '11223344', '123123123', '123321123', '1q2w3e4r', '1q2w3e4r5t', '1qaz2wsx',
  'q1w2e3r4', 'qwertyui', 'qwertyuiop', 'qwerty12', 'qwerty123', 'qwerty1234', 'asdfghjk', 'asdfghjkl',
  'asdfasdf', 'zaq12wsx', 'zxcvbnm1', 'abc12345', 'abcd1234', 'abcdefgh', 'iloveyou', 'iloveyou1',
  'sunshine', 'sunshine1', 'princess', 'princess1', 'football', 'football1', 'baseball', 'baseball1',
  'welcome1', 'welcome123', 'letmein1', 'letmein123', 'trustno1', 'superman', 'starwars', 'whatever',
  'admin123', 'admin1234', 'administrator', 'changeme', 'changeme1', 'computer', 'internet', 'michelle',
  'jennifer', 'charlie1', 'master12', 'monkey12', 'dragon12', 'shadow12', 'mustang1', 'basketball',
  'liverpool', 'chelsea1', 'jordan23', 'freedom1', 'hello123', 'secret123', 'test1234', 'testtest',
  'welkom01', 'wachtwoord', 'wachtwoord1', 'passwort', 'passwort1', 'motdepasse', 'contraseña',
])

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase())
}

async function sha1HexUpper(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

/** HIBP range query. Returns false (fail open) on any transport problem. */
export async function isPwnedViaHibp(
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const sha1 = await sha1HexUpper(password)
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)
  const started = Date.now()
  try {
    const res = await fetchImpl(`${HIBP_RANGE_URL}${prefix}`, {
      headers: { 'Add-Padding': 'true', 'user-agent': 'qesto-password-screen' },
      signal: AbortSignal.timeout(HIBP_TIMEOUT_MS),
    })
    if (!res.ok) {
      logExternalFailure(new Error(`hibp status ${res.status}`), {
        traceId: 'hibp',
        route: 'lib/breached-password',
        provider: 'hibp',
        httpStatus: res.status,
        outcome: 'fail_open',
        duration: Date.now() - started,
      })
      return false
    }
    const body = await res.text()
    for (const line of body.split('\n')) {
      const [hashSuffix, count] = line.trim().split(':')
      // Padding entries carry a count of 0.
      if (hashSuffix === suffix && Number(count) > 0) return true
    }
    return false
  } catch (err) {
    logExternalFailure(err, {
      traceId: 'hibp',
      route: 'lib/breached-password',
      provider: 'hibp',
      outcome: 'fail_open',
      duration: Date.now() - started,
    })
    return false
  }
}

/** True when a candidate NEW password must be refused. */
export async function isBreachedPassword(
  env: { BREACHED_PASSWORD_CHECK?: string },
  password: string,
  fetchImpl?: typeof fetch,
): Promise<boolean> {
  if (isCommonPassword(password)) return true
  if (env.BREACHED_PASSWORD_CHECK === 'hibp') return isPwnedViaHibp(password, fetchImpl)
  return false
}
