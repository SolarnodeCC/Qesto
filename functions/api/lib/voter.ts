// Voter deduplication (PSM-007).
//
// A voterId is stable for (IP + browser fingerprint) pairs within one session.
// Registered users (presenter and future authenticated voters) bypass the
// anonymous path and keep their user id.
//
// DD-03 — why this is keyed, not just hashed.
//
// The previous derivation was `sha256(ip).slice(0, 8)`: an UNSALTED SHA-256 of a
// 32-bit input, truncated to 32 bits. The IPv4 space is 2^32, so a complete
// rainbow table inverts it in minutes on commodity hardware — and the result was
// written to `votes.voter_id` for every anonymous vote, in every anonymity mode.
// The fingerprint added 48 nominal bits over `user-agent | accept-language |
// accept-encoding`, a tuple whose realistic distinct-value count is in the low
// millions, not 2^48. Under GDPR Recital 26 and EDPB Opinion 05/2014 a
// reversible hash is pseudonymisation, not anonymisation: still personal data.
//
// The identifier is now HMAC-SHA256 under a 32-byte random salt generated per
// session (`sessions.voter_salt`, migration 0082). Three properties follow:
//   * dedupe still works inside a session — same voter, same id;
//   * the same IP produces unrelated ids in different sessions, so votes can no
//     longer be correlated across sessions;
//   * destroying the salt at session close makes that session's stored ids
//     permanently un-invertible, because the key no longer exists anywhere.
//
// Sessions created before migration 0082 have no salt. They fall back to the
// legacy derivation so in-flight sessions are not disrupted; the fallback is
// clearly marked and should be removed once no pre-0082 session is live.

const TE = new TextEncoder()

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', TE.encode(input))
  const bytes = new Uint8Array(digest)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

// Fingerprint from the headers the Worker always sees.
//
// SECURITY (#583): we deliberately do NOT fold the client-controlled
// `X-Qesto-Fingerprint` header into the dedupe identity. A voter could rotate
// that header on every request to mint a fresh voterId and bypass vote
// deduplication. The dedupe identity is anchored on the server-trusted
// `cf-connecting-ip`-derived ipHash; the remaining headers only bucket multiple
// tabs from the same UA together and cannot be used to escape a bucket.
function fingerprintInput(request: Request): string {
  const h = request.headers
  return [
    h.get('user-agent') ?? '',
    h.get('accept-language') ?? '',
    h.get('accept-encoding') ?? '',
  ].join('|')
}

function clientIp(request: Request): string {
  // #584: only `cf-connecting-ip` is set by Cloudflare and trustworthy. The
  // `x-forwarded-for` / `x-real-ip` headers are attacker-controlled and must not
  // feed `ipHash` — which drives the anonymous voterId, the per-IP connect rate
  // limit and the concurrent cap. Behind Cloudflare this header is always present;
  // anything else falls back to a single stable bucket rather than a spoofable one.
  return request.headers.get('cf-connecting-ip') ?? 'unknown'
}

export type VoterIdentity = {
  voterId: string
  ipHash: string
  fingerprint: string
}

/** 32 random bytes as hex — the per-session key for `deriveVoterIdentity`. */
export function generateVoterSalt(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

async function hmacHex(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    TE.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, TE.encode(data))
  let out = ''
  for (const b of new Uint8Array(mac)) out += b.toString(16).padStart(2, '0')
  return out
}

/**
 * Derive the per-session anonymous voter identity.
 *
 * @param sessionSalt `sessions.voter_salt`. When absent (session predates
 *   migration 0082) the legacy unsalted derivation is used so a live session is
 *   not disrupted — see the DD-03 note at the top of this file.
 */
export async function deriveVoterIdentity(
  request: Request,
  sessionSalt?: string | null,
): Promise<VoterIdentity> {
  const ip = clientIp(request)
  const fingerprintSource = fingerprintInput(request)

  if (!sessionSalt) {
    // LEGACY — invertible. Retained only for sessions created before 0082.
    const ipHash = (await sha256Hex(ip)).slice(0, 8)
    const fingerprint = (await sha256Hex(fingerprintSource)).slice(0, 12)
    return { voterId: `anon_${ipHash}_${fingerprint}`, ipHash, fingerprint }
  }

  // Full-length digest, not a truncation: the previous 32-bit slice was small
  // enough to brute-force independently of the salt.
  const mac = await hmacHex(sessionSalt, `${ip}|${fingerprintSource}`)
  return {
    voterId: `anon_${mac}`,
    // ipHash keys the per-IP connection cap and rate limiter. It stays derived
    // from the IP alone (so it groups a real IP's sockets) but is now salted, so
    // it is no longer a portable identifier for that IP outside this session.
    ipHash: (await hmacHex(sessionSalt, ip)).slice(0, 16),
    fingerprint: mac.slice(0, 16),
  }
}

export async function ipHashFor(request: Request): Promise<string> {
  return (await sha256Hex(clientIp(request))).slice(0, 8)
}
