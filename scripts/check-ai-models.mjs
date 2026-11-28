#!/usr/bin/env node
/**
 * check-ai-models.mjs — validate every id in functions/api/lib/ai/models.ts
 * against the live Workers AI catalog.
 *
 * The AI binding is mocked in unit tests, so an invalid model id only fails in
 * production. This lane catches that before deploy.
 *
 * Needs CLOUDFLARE_API_TOKEN (Workers AI Read) + CLOUDFLARE_ACCOUNT_ID. Without
 * them it exits 0 with a warning (pass --require to fail instead).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const src = readFileSync(resolve(ROOT, 'functions/api/lib/ai/models.ts'), 'utf8')
const ids = [...src.matchAll(/^\s+[A-Z0-9_]+:\s*'(@(?:cf|hf)\/[^']+)'/gm)].map((m) => m[1])
const require = process.argv.includes('--require')
const token = process.env.CLOUDFLARE_API_TOKEN
const account = process.env.CLOUDFLARE_ACCOUNT_ID

if (ids.length === 0) {
  console.error('✗ no model ids parsed from lib/ai/models.ts')
  process.exit(1)
}
if (!token || !account) {
  const msg = 'CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not set — live catalog check skipped'
  if (require) {
    console.error(`✗ ${msg}`)
    process.exit(1)
  }
  console.warn(`⚠ ${msg}`)
  process.exit(0)
}

let failed = 0
for (const id of ids) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/ai/models/schema?model=${encodeURIComponent(id)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const body = await res.json().catch(() => ({}))
  if (body?.success) {
    console.log(`✓ ${id}`)
  } else {
    failed++
    console.error(`✗ ${id} — ${JSON.stringify(body?.errors ?? res.status)}`)
  }
}
if (failed) {
  console.error(`\n${failed} model id(s) not in the Workers AI catalog`)
  process.exit(1)
}
console.log(`\nAll ${ids.length} model ids are valid.`)
