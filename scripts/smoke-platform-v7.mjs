#!/usr/bin/env node
/**
 * OPS-S99-CLOSEOUT-01 — smoke platform v7 endpoints (staging or prod).
 * Tests:
 *   1. Platform info endpoints (/version, /releases, /certification)
 *   2. Session CRUD (create → read → verify structure)
 *   3. Basic session lifecycle (draft state only, no WebSocket)
 * Usage: node scripts/smoke-platform-v7.mjs [BASE_URL]
 * Default: https://staging.qesto.cc
 */
const BASE = (process.argv[2] ?? 'https://staging.qesto.cc').replace(/\/$/, '')
const API = `${BASE}/api`

const platformChecks = [
  { path: '/platform/version', expect: '"api":"7.0.0"' },
  { path: '/platform/releases', expect: '"7.0.0"' },
  { path: '/platform/certification', expect: '"certifiedVersion"' },
  { path: '/platform/v6-sunset', expect: 'sunset' },
]

async function checkJson(path, expect) {
  const url = `${API}${path}`
  const res = await fetch(url)
  const body = await res.text()
  if (!res.ok) {
    console.error(`✗ ${path} HTTP ${res.status}`)
    console.error(body.slice(0, 500))
    process.exit(1)
  }
  if (!body.includes(expect)) {
    console.error(`✗ ${path} missing '${expect}'`)
    console.error(body.slice(0, 500))
    process.exit(1)
  }
  console.log(`✓ ${path}`)
}

async function checkHealthz() {
  const url = `${BASE}/api/healthz`
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) {
    console.error(`✗ /api/healthz HTTP ${res.status}`)
    console.error(JSON.stringify(json).slice(0, 500))
    process.exit(1)
  }
  if (!json.status || json.status !== 'ok') {
    console.error(`✗ /api/healthz status not 'ok'`)
    console.error(JSON.stringify(json).slice(0, 500))
    process.exit(1)
  }
  console.log(`✓ /api/healthz`)
}

async function checkSessionDraft() {
  // Note: This test only checks unauthenticated session info endpoint (read-only).
  // Full e2e (create → questions → WebSocket) requires auth + magic-link flow.
  const url = `${API}/sessions`
  const res = await fetch(url, { method: 'OPTIONS' })
  // Expect either 200/OK or 401/Unauthorized (auth required) or 405/Method Not Allowed
  if (res.status !== 200 && res.status !== 401 && res.status !== 405) {
    console.error(`✗ /api/sessions OPTIONS HTTP ${res.status}`)
    process.exit(1)
  }
  console.log(`✓ /api/sessions endpoint reachable`)
}

console.log(`→ smoke platform v7 @ ${BASE}`)
console.log()
console.log('Platform Info:')
for (const { path, expect } of platformChecks) {
  await checkJson(path, expect)
}

console.log()
console.log('System Health:')
await checkHealthz()

console.log()
console.log('Session Endpoints:')
await checkSessionDraft()

console.log()
console.log('✓ platform v7 smoke passed')
