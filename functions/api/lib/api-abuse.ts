/**
 * SEC-API-ABUSE-01 — abuse scoring for public API (IP + API key).
 */
const WINDOW_SEC = 300
const BLOCK_THRESHOLD = 50

export function apiAbuseKvKey(ipHash: string, apiKeyId: string): string {
  return `api:abuse:${ipHash}:${apiKeyId}`
}

export async function recordApiAbuseSignal(
  kv: KVNamespace | undefined,
  ipHash: string,
  apiKeyId: string,
  signal: 'auth_fail' | 'rate_limit' | 'invalid_path',
): Promise<{ score: number; blocked: boolean }> {
  if (!kv) return { score: 0, blocked: false }
  const key = apiAbuseKvKey(ipHash, apiKeyId)
  const weight = signal === 'auth_fail' ? 5 : signal === 'rate_limit' ? 3 : 1
  const prev = Number((await kv.get(key)) ?? '0')
  const score = prev + weight
  await kv.put(key, String(score), { expirationTtl: WINDOW_SEC })
  return { score, blocked: score >= BLOCK_THRESHOLD }
}

export async function isApiAbuseBlocked(
  kv: KVNamespace | undefined,
  ipHash: string,
  apiKeyId: string,
): Promise<boolean> {
  if (!kv) return false
  const score = Number((await kv.get(apiAbuseKvKey(ipHash, apiKeyId))) ?? '0')
  return score >= BLOCK_THRESHOLD
}

export function clientIpHash(req: Request): string {
  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  return ip.slice(0, 64)
}
