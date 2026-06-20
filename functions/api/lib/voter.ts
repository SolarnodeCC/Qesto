// Voter deduplication (PSM-007).
//
// A voterId is stable for (IP + browser fingerprint) pairs. We never store the
// raw IP or user-agent — only SHA-256 slices. Registered users (presenter and
// future authenticated voters) bypass the anonymous path and keep their user id.

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
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for') ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

export type VoterIdentity = {
  voterId: string
  ipHash: string
  fingerprint: string
}

export async function deriveVoterIdentity(request: Request): Promise<VoterIdentity> {
  const ip = clientIp(request)
  const ipHash = (await sha256Hex(ip)).slice(0, 8)
  const fingerprint = (await sha256Hex(fingerprintInput(request))).slice(0, 12)
  return { voterId: `anon_${ipHash}_${fingerprint}`, ipHash, fingerprint }
}

export async function ipHashFor(request: Request): Promise<string> {
  return (await sha256Hex(clientIp(request))).slice(0, 8)
}
