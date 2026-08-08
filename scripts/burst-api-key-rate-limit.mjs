#!/usr/bin/env node
/**
 * ADR-0073 / WS-1b — burst harness for public API key rate limit canary (WS-2).
 *
 * Fires N concurrent requests against a single API key and reports allow vs 429.
 * Workers Rate Limiting is colo-local and intentionally permissive — expect
 * observed accepts ≤ configured limit (120/min) ± colo slack when the flag is on
 * and traffic sticks to one Cloudflare location.
 *
 * Usage:
 *   API_KEY=qesto_… node scripts/burst-api-key-rate-limit.mjs [BASE_URL] [TOTAL] [CONCURRENCY]
 *
 * Defaults: BASE_URL=https://qesto.cc  TOTAL=150  CONCURRENCY=50
 * Path: GET /api/v1/sessions (or first path that requires the public API key).
 *
 * Env:
 *   API_KEY          required — raw `qesto_…` bearer key
 *   BURST_PATH       optional — default `/api/v1/sessions`
 *   EXPECT_LIMIT     optional — default 120 (documentation / soft assert)
 *
 * Exit codes:
 *   0 — completed; prints summary (does not fail solely on over-accept — colo slack)
 *   1 — missing API_KEY / transport errors / unexpected non-401/429/2xx flood
 */
const BASE = (process.argv[2] ?? process.env.BASE_URL ?? 'https://qesto.cc').replace(/\/$/, '')
const TOTAL = Number(process.argv[3] ?? process.env.BURST_TOTAL ?? 150)
const CONCURRENCY = Number(process.argv[4] ?? process.env.BURST_CONCURRENCY ?? 50)
const PATH = process.env.BURST_PATH ?? '/api/v1/sessions'
const EXPECT_LIMIT = Number(process.env.EXPECT_LIMIT ?? 120)
const API_KEY = process.env.API_KEY

if (!API_KEY || !/^qesto_[0-9a-f]{32}$/.test(API_KEY)) {
  console.error('API_KEY required (format qesto_ + 32 hex). Refusing to run.')
  process.exit(1)
}

const url = `${BASE}${PATH.startsWith('/') ? PATH : `/${PATH}`}`

async function one() {
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${API_KEY}`,
      accept: 'application/json',
    },
  })
  const retryAfter = res.headers.get('retry-after')
  return { status: res.status, retryAfter }
}

async function pool(n, concurrency, fn) {
  const results = []
  let i = 0
  async function worker() {
    while (i < n) {
      const idx = i++
      results[idx] = await fn()
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, n) }, () => worker()))
  return results
}

const started = Date.now()
const results = await pool(TOTAL, CONCURRENCY, one)
const elapsedMs = Date.now() - started

const byStatus = new Map()
let withRetryAfter = 0
for (const r of results) {
  byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1)
  if (r.retryAfter) withRetryAfter += 1
}

const okish = [...byStatus.entries()]
  .filter(([s]) => s >= 200 && s < 300)
  .reduce((a, [, c]) => a + c, 0)
const limited = byStatus.get(429) ?? 0
const unauth = byStatus.get(401) ?? 0
const other = TOTAL - okish - limited - unauth

console.log(JSON.stringify({
  base: BASE,
  path: PATH,
  total: TOTAL,
  concurrency: CONCURRENCY,
  elapsedMs,
  expectLimit: EXPECT_LIMIT,
  okish,
  limited429: limited,
  unauth401: unauth,
  other,
  withRetryAfter,
  byStatus: Object.fromEntries(byStatus),
  notes: [
    'Workers Rate Limiting is colo-local; multi-colo fan-out can exceed a single-colo budget in aggregate.',
    'When ATOMIC_RATE_LIMIT_ENABLED=false, legacy KV TOCTOU may allow modest overage under burst.',
    'When flag=true, expect okish ≲ EXPECT_LIMIT (± colo slack) for a single-location canary.',
  ],
}, null, 2))

if (unauth > 0 && okish === 0 && limited === 0) {
  console.error('All requests unauthenticated — check API_KEY / path.')
  process.exit(1)
}
if (other > TOTAL * 0.1) {
  console.error(`Unexpected status flood (other=${other}). Inspect byStatus.`)
  process.exit(1)
}
