#!/usr/bin/env node
/**
 * check-pages-config-drift.mjs — fail when the LIVE Pages production config
 * drifts from wrangler.toml.
 *
 * Why: production `/api` is served by the Cloudflare Pages project `qesto`
 * (functions/[[path]].ts). Its bindings and vars live in the Pages dashboard,
 * NOT in wrangler.toml (which configures the `qesto-api` Worker: DO, cron,
 * queue consumer). The two silently diverged — Pages was missing
 * INSIGHTS_QUEUE, R2_VIDEOS and a dozen security/feature flags, and had
 * INTEGRATION_ENABLED="1" (read as false) — while CI stayed green.
 *
 * Compares wrangler.toml [vars] and binding names against
 * GET /accounts/{id}/pages/projects/{project} → deployment_configs.production.
 * Binding kinds Pages cannot bind (ratelimits, workflows) and per-deploy vars
 * are skipped. Secrets are never read (only names are compared).
 *
 * Usage: CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… node scripts/check-pages-config-drift.mjs [project]
 * Without credentials: warns and exits 0 (pass --require to fail instead).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const project = process.argv.find((a, i) => i >= 2 && !a.startsWith('--')) ?? 'qesto'
const requireCreds = process.argv.includes('--require')

/** Vars that legitimately differ per deploy or per runtime. */
const VAR_IGNORE = new Set(['COMMIT_SHA', 'CF_ACCESS_AUDIENCE', 'CF_ACCESS_CERTS_URL'])

/** Minimal parser for the subset of wrangler.toml we need (top-level only). */
export function parseWranglerToml(text) {
  const vars = {}
  const bindings = { kv: [], d1: [], r2: [], vectorize: [], ai: [], analytics: [], queueProducers: [], durableObjects: [] }
  let section = ''
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').trim()
    if (!line || line.startsWith('#')) continue
    const header = line.match(/^\[\[?([^\]]+)\]\]?$/)
    if (header) {
      section = header[1].trim()
      continue
    }
    if (section.startsWith('env.')) continue // only the production (top-level) config
    const kv = line.match(/^([A-Za-z0-9_]+)\s*=\s*"([^"]*)"/)
    if (!kv) continue
    const [, key, value] = kv
    if (section === 'vars') vars[key] = value
    else if (key === 'binding' || (key === 'name' && section === 'durable_objects.bindings')) {
      const map = {
        kv_namespaces: 'kv',
        d1_databases: 'd1',
        r2_buckets: 'r2',
        vectorize: 'vectorize',
        ai: 'ai',
        analytics_engine_datasets: 'analytics',
        'queues.producers': 'queueProducers',
        'durable_objects.bindings': 'durableObjects',
      }
      const kind = map[section]
      if (kind) bindings[kind].push(value)
    }
  }
  return { vars, bindings }
}

export function diffConfig(expected, pagesProd) {
  const problems = []
  const pagesKeys = (o) => Object.keys(o ?? {})
  const check = (kind, wanted, have) => {
    for (const name of wanted) if (!have.includes(name)) problems.push(`missing ${kind} binding: ${name}`)
  }
  check('KV', expected.bindings.kv, pagesKeys(pagesProd.kv_namespaces))
  check('D1', expected.bindings.d1, pagesKeys(pagesProd.d1_databases))
  check('R2', expected.bindings.r2, pagesKeys(pagesProd.r2_buckets))
  check('Vectorize', expected.bindings.vectorize, pagesKeys(pagesProd.vectorize_bindings))
  check('AI', expected.bindings.ai, pagesKeys(pagesProd.ai_bindings))
  check('Analytics Engine', expected.bindings.analytics, pagesKeys(pagesProd.analytics_engine_datasets))
  check('Queue producer', expected.bindings.queueProducers, pagesKeys(pagesProd.queue_producers))
  check('Durable Object', expected.bindings.durableObjects, pagesKeys(pagesProd.durable_object_namespaces))

  const envVars = pagesProd.env_vars ?? {}
  for (const [key, value] of Object.entries(expected.vars)) {
    if (VAR_IGNORE.has(key)) continue
    const live = envVars[key]
    if (!live) {
      problems.push(`missing var: ${key} (wrangler.toml = "${value}")`)
    } else if (live.type === 'plain_text' && live.value !== value) {
      problems.push(`var mismatch: ${key} live="${live.value}" wrangler.toml="${value}"`)
    }
  }
  return problems
}

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN
  const account = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!token || !account) {
    const msg = 'CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not set — Pages config drift check skipped'
    if (requireCreds) {
      console.error(`✗ ${msg}`)
      process.exit(1)
    }
    console.warn(`⚠ ${msg}`)
    return
  }
  const expected = parseWranglerToml(readFileSync(resolve(ROOT, 'wrangler.toml'), 'utf8'))
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${project}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.json().catch(() => ({}))
  if (!body?.success) {
    console.error(`✗ could not read Pages project "${project}": ${JSON.stringify(body?.errors ?? res.status)}`)
    process.exit(1)
  }
  const problems = diffConfig(expected, body.result?.deployment_configs?.production ?? {})
  if (problems.length > 0) {
    console.error(`✗ Pages project "${project}" production config drifted from wrangler.toml:`)
    for (const p of problems) console.error(`  - ${p}`)
    console.error('\nFix in the Pages dashboard (Settings → Functions / Variables) or update wrangler.toml.')
    process.exit(1)
  }
  console.log(`✓ Pages project "${project}" production config matches wrangler.toml`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
