#!/usr/bin/env node
/**
 * OPS-S99-CLOSEOUT-01 — smoke public /api/platform/* endpoints (staging or prod).
 * Usage: node scripts/smoke-platform-v7.mjs [BASE_URL]
 * Default: https://staging.qesto.cc
 */
const BASE = (process.argv[2] ?? 'https://staging.qesto.cc').replace(/\/$/, '')
const API = `${BASE}/api/platform`

const checks = [
  { path: '/version', expect: '"api":"7.0.0"' },
  { path: '/releases', expect: '"7.0.0"' },
  { path: '/certification', expect: '"certifiedVersion"' },
  { path: '/v6-sunset', expect: 'sunset' },
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

console.log(`→ smoke platform v7 @ ${API}`)
for (const { path, expect } of checks) {
  await checkJson(path, expect)
}
console.log('✓ platform v7 smoke passed')
