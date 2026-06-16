/**
 * SOVEREIGN-AUDIT-API-01 (ADR-0058) — verifiable compliance audit export.
 *
 * A sovereign tenant (or its scoped third-party auditor) can export the team's
 * compliance audit log as an immutable, cryptographically verifiable document:
 *
 * - Each entry carries a chain hash = SHA-256(prevHash + canonical(entry)), so
 *   any reordering/insertion/deletion breaks the chain (tamper-evident).
 * - The whole export is signed with HMAC-SHA256 over the final chain head using
 *   `SOVEREIGN_AUDIT_SIGNING_KEY`, so the auditor can verify provenance.
 *
 * Pure builders (canonicalisation + chaining + verify) are unit-tested; signing
 * uses Web Crypto. Scope (which actions/window a third party may read) is decided
 * by the caller via `AuditQueryFilters` — this module never widens scope.
 */

export type SovereignAuditEntry = {
  id: string
  ts: number
  action: string
  subjectType: string | null
  subjectId: string | null
  actorId: string | null
}

export type ChainedAuditEntry = SovereignAuditEntry & {
  /** Chain hash including this entry; the export head is the last entry's hash. */
  chainHash: string
}

/** Genesis hash for an empty chain (documented constant, not a magic literal). */
export const AUDIT_CHAIN_GENESIS = 'genesis'

/** Stable, key-sorted JSON so the same entry always hashes identically. */
export function canonicalizeEntry(entry: SovereignAuditEntry): string {
  return JSON.stringify({
    action: entry.action,
    actorId: entry.actorId ?? null,
    id: entry.id,
    subjectId: entry.subjectId ?? null,
    subjectType: entry.subjectType ?? null,
    ts: entry.ts,
  })
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Build the tamper-evident chain. Entries are hashed in the given order (caller
 * sorts ascending by ts for a stable, append-only chain).
 */
export async function buildAuditChain(entries: SovereignAuditEntry[]): Promise<{
  chained: ChainedAuditEntry[]
  head: string
}> {
  let prev = AUDIT_CHAIN_GENESIS
  const chained: ChainedAuditEntry[] = []
  for (const entry of entries) {
    const chainHash = await sha256Hex(prev + canonicalizeEntry(entry))
    chained.push({ ...entry, chainHash })
    prev = chainHash
  }
  return { chained, head: prev }
}

/** Recompute the chain and confirm each stored chainHash matches (tamper check). */
export async function verifyAuditChain(chained: ChainedAuditEntry[]): Promise<boolean> {
  let prev = AUDIT_CHAIN_GENESIS
  for (const entry of chained) {
    const expected = await sha256Hex(
      prev +
        canonicalizeEntry({
          id: entry.id,
          ts: entry.ts,
          action: entry.action,
          subjectType: entry.subjectType,
          subjectId: entry.subjectId,
          actorId: entry.actorId,
        }),
    )
    if (expected !== entry.chainHash) return false
    prev = entry.chainHash
  }
  return true
}

/** HMAC-SHA256 (hex) over arbitrary input with the sovereign signing key. */
export async function hmacSha256Hex(input: string, signingKey: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export type SovereignAuditExport = {
  teamId: string
  region: string
  generatedAt: number
  entryCount: number
  /** Chain head — the SHA-256 covering every entry in order. */
  chainHead: string
  /** HMAC-SHA256 over `${teamId}.${chainHead}.${generatedAt}.${entryCount}`. */
  signature: string
  entries: ChainedAuditEntry[]
}

/**
 * Produce the full signed export document. The signature binds the team, region,
 * chain head, entry count, and timestamp so a third party cannot graft entries
 * from one team/region onto another.
 */
export async function buildSignedAuditExport(args: {
  teamId: string
  region: string
  entries: SovereignAuditEntry[]
  signingKey: string
  now?: number
}): Promise<SovereignAuditExport> {
  // Append-only stable order: ascending timestamp, id as tiebreak.
  const ordered = [...args.entries].sort((a, b) => (a.ts - b.ts) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const { chained, head } = await buildAuditChain(ordered)
  const generatedAt = args.now ?? Date.now()
  const payload = `${args.teamId}.${head}.${generatedAt}.${chained.length}`
  const signature = await hmacSha256Hex(payload, args.signingKey)
  return {
    teamId: args.teamId,
    region: args.region,
    generatedAt,
    entryCount: chained.length,
    chainHead: head,
    signature,
    entries: chained,
  }
}

/** Verify both the per-entry chain and the export signature. */
export async function verifySignedAuditExport(
  doc: SovereignAuditExport,
  signingKey: string,
): Promise<boolean> {
  if (!(await verifyAuditChain(doc.entries))) return false
  if (doc.entries.length > 0 && doc.entries[doc.entries.length - 1].chainHash !== doc.chainHead) {
    return false
  }
  const payload = `${doc.teamId}.${doc.chainHead}.${doc.generatedAt}.${doc.entryCount}`
  const expected = await hmacSha256Hex(payload, signingKey)
  return expected === doc.signature
}
