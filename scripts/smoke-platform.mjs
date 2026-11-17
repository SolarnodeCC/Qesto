#!/usr/bin/env node
/**
 * OPS-S99-CLOSEOUT-01 — smoke platform v7 endpoints.
 * Tests:
 *   1. Platform info endpoints (/version, /releases, /certification)
 *   2. Session CRUD (create → read → verify structure)
 *   3. Basic session lifecycle (draft state only, no WebSocket)
 * Usage: node scripts/smoke-platform.mjs [BASE_URL]
 * Default: https://qesto.cc
 */
import { fetchUntilDeployed } from './deploy-propagation.mjs'

const BASE = (process.argv[2] ?? 'https://qesto.cc').replace(/\/$/, '')
const API = `${BASE}/api`

const platformChecks = [
  { path: '/platform/version', expect: '"api":"7.0.0"' },
  { path: '/platform/releases', expect: '"7.0.0"' },
  { path: '/platform/certification', expect: '"certifiedVersion"' },
  // The body only says "Sunset-Date" (capital S), so the old lowercase 'sunset'
  // expectation could never match; this step was skipped on every release until
  // the deploy job stopped failing earlier, so the mismatch went unnoticed.
  { path: '/platform/v6-sunset', expect: '"v6MaintenanceEnd"' },
]

async function checkJson(path, expect) {
  const url = `${API}${path}`
  const res = await fetchUntilDeployed(url)
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

// There was never an /api/healthz route: this check hit the auth middleware and
// got a 401, unnoticed because the step never ran. Use the real health probe.
async function checkHealth() {
  const url = `${BASE}/api/admin/health`
  const res = await fetchUntilDeployed(url)
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    console.error(`✗ /api/admin/health HTTP ${res.status}`)
    console.error(JSON.stringify(json).slice(0, 500))
    process.exit(1)
  }
  if (json?.ok !== true) {
    console.error(`✗ /api/admin/health ok is not true`)
    console.error(JSON.stringify(json).slice(0, 500))
    process.exit(1)
  }
  console.log(`✓ /api/admin/health`)
}

async function checkSessionDraft() {
  // Note: This test only checks unauthenticated session info endpoint (read-only).
  // Full e2e (create → questions → WebSocket) requires auth + magic-link flow.
  const url = `${API}/sessions`
  const res = await fetchUntilDeployed(url, { method: 'OPTIONS' })
  // Expect 200/OK, 204 (the CORS middleware answers a preflight with No Content),
  // 401/Unauthorized (auth required) or 405/Method Not Allowed.
  if (![200, 204, 401, 405].includes(res.status)) {
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
await checkHealth()

console.log()
console.log('Session Endpoints:')
await checkSessionDraft()

console.log()
console.log('✓ platform v7 smoke passed')
