#!/usr/bin/env node
/**
 * OPS-QUEUE-BIND-01 / Phase 0 — probe production (or staging) binding health.
 *
 * Usage:
 *   node scripts/audit-platform-bindings.mjs [BASE_URL]
 *   npm run audit:bindings -- https://qesto.cc
 *
 * Reads GET /api/admin/health and fails when required bindings are missing.
 * Optional: CF_ACCESS_CLIENT_ID + CF_ACCESS_CLIENT_SECRET for Access-protected deploys.
 */
const BASE = (process.argv[2] ?? process.env.APP_URL ?? 'https://qesto.cc').replace(/\/$/, '')
const url = `${BASE}/api/admin/health`

const cfAccessHeaders = {}
if (process.env.CF_ACCESS_CLIENT_ID) cfAccessHeaders['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID
if (process.env.CF_ACCESS_CLIENT_SECRET) cfAccessHeaders['CF-Access-Client-Secret'] = process.env.CF_ACCESS_CLIENT_SECRET

console.log(`→ platform binding audit @ ${url}`)

let res
try {
  res = await fetch(url, { headers: { accept: 'application/json', ...cfAccessHeaders } })
} catch (err) {
  console.error(`✗ fetch failed: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
}

const bodyText = await res.text()
if (!res.ok) {
  console.error(`✗ HTTP ${res.status}`)
  console.error(bodyText.slice(0, 800))
  process.exit(1)
}

let json
try {
  json = JSON.parse(bodyText)
} catch {
  console.error('✗ response is not JSON')
  console.error(bodyText.slice(0, 800))
  process.exit(1)
}

const bindings = json?.data?.bindings
if (!bindings?.probes) {
  console.error('✗ /api/admin/health missing data.bindings (deploy API/Worker with platform-bindings probe)')
  console.error(JSON.stringify(json, null, 2).slice(0, 1200))
  process.exit(1)
}

console.log(`  env: ${json.data?.env ?? 'unknown'}`)
console.log(`  commit: ${json.data?.commit ?? 'unknown'}`)
console.log(`  degraded: ${bindings.degraded}`)
console.log()

for (const probe of bindings.probes) {
  const mark = probe.bound ? '✓' : probe.required ? '✗' : '○'
  console.log(`${mark} ${probe.name} bound=${probe.bound} required=${probe.required}${probe.detail ? ` (${probe.detail})` : ''}`)
}

if (bindings.missingRequired?.length) {
  console.error(`\n✗ missing required bindings: ${bindings.missingRequired.join(', ')}`)
  process.exit(1)
}

if (json.data?.platformReady === false) {
  console.error('\n✗ platformReady=false')
  process.exit(1)
}

console.log('\n✓ platform binding audit passed')
