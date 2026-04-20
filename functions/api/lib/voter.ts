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

// Fingerprint from the headers the Worker always sees. Browser-side components
// (screen, timezone) land on a future `X-Qesto-Fingerprint` header when we add
// that to the join page; for v1 the headers below are enough to keep multiple
// tabs from the same UA bucketed together.
function fingerprintInput(request: Request): string {
  const h = request.headers
  return [
    h.get('user-agent') ?? '',
    h.get('accept-language') ?? '',
    h.get('accept-encoding') ?? '',
    h.get('x-qesto-fingerprint') ?? '',
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
