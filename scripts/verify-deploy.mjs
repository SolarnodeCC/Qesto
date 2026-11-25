#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Pages deploy does not apply wrangler.toml (that file is the Worker config;
 * adopting it as the Pages source of truth would replace dashboard bindings).
 * Required probes such as INSIGHTS_QUEUE can therefore be absent until an
 * operator binds them on the Pages project. Same contract as
 * scripts/smoke-platform.mjs: warn by default, fail only when
 * SMOKE_REQUIRE_BINDINGS=1, so an unbound queue does not block every release.
 *
 * @param {unknown} missingRequired
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ action: 'ok' | 'warn' | 'fail', missing: string[] }}
 */
export function bindingProbeDecision(missingRequired, env = process.env) {
  const missing = Array.isArray(missingRequired)
    ? missingRequired.filter((name) => typeof name === 'string' && name.length > 0)
    : []
  if (missing.length === 0) return { action: 'ok', missing }
  if (env.SMOKE_REQUIRE_BINDINGS === '1') return { action: 'fail', missing }
  return { action: 'warn', missing }
}

function localCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 12)
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unknown'
  }
}

// Parse the built index.html to find real asset filenames (hashed by Vite).
// This ensures we verify the exact files that were deployed, not hardcoded names.
function parseDistAssets() {
  try {
    const indexHtml = readFileSync(resolve('dist/index.html'), 'utf8')
    const jsMatch = indexHtml.match(/src="(\/[^"]+\.js)"/)
    const cssMatch = indexHtml.match(/href="(\/assets\/[^"]+\.css)"/)
    return {
      js: jsMatch?.[1] ?? null,
      css: cssMatch?.[1] ?? null,
    }
  } catch {
    return { js: null, css: null }
  }
}

async function checkAssetMime(url, expectedType, label, headers) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', headers })
    const ct = res.headers.get('content-type') ?? ''
    const ok = ct.includes(expectedType)
    const status = ok ? '✓' : '✗'
    console.log(`${status} ${label} MIME (${res.status}): ${ct || 'missing'}`)
    if (!ok) {
      console.error(`  Expected "${expectedType}", got "${ct}"`)
      console.error(`  URL: ${url}`)
      if (ct.includes('text/html')) {
        console.error(`  → Asset returned HTML — likely a Cloudflare Pages SPA fallback.`)
        console.error(`    Check that the file exists in dist/ and was uploaded in this deploy.`)
      }
    }
    return ok
  } catch (err) {
    console.error(`✗ ${label} MIME check failed: ${err.message}`)
    return false
  }
}

async function main() {
const baseUrl = process.argv[2] ?? process.env.APP_URL

if (!baseUrl) {
  console.error('Usage: npm run verify:deploy -- <base-url>')
  console.error('Example: npm run verify:deploy -- https://qesto2-github.oostelaar.workers.dev')
  process.exit(1)
}

const local = localCommit()
const origin = baseUrl.replace(/\/$/, '')
const versionUrl = `${origin}/api/version`

// Allow CI runners to authenticate through Cloudflare Access
const cfAccessHeaders = {}
if (process.env.CF_ACCESS_CLIENT_ID) cfAccessHeaders['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID
if (process.env.CF_ACCESS_CLIENT_SECRET) cfAccessHeaders['CF-Access-Client-Secret'] = process.env.CF_ACCESS_CLIENT_SECRET

let exitCode = 0

// ── Step 1: API version / commit parity check ─────────────────────────────
try {
  // A just-created *.pages.dev deployment can still answer 404 from some edge
  // nodes (run 3188), so retry a 404 or 5xx a few times before calling it a
  // failure. Other statuses, including 403, fail immediately.
  let res
  for (let attempt = 1; attempt <= 6; attempt++) {
    res = await fetch(versionUrl, {
      headers: { accept: 'application/json', ...cfAccessHeaders },
      redirect: 'follow',
    })
    if (res.ok || (res.status !== 404 && res.status < 500) || attempt === 6) break
    console.warn(`  ${res.status} from ${versionUrl}; retrying (${attempt}/5)…`)
    await new Promise((r) => setTimeout(r, 3000))
  }
  if (!res.ok) {
    // A 403 used to exit 0 here ("production is behind Cloudflare Access"), so the
    // check passed on every release without verifying anything. qesto.cc has no
    // Access app; the 403 came from Bot Fight Mode blocking GitHub's runners. CI
    // now verifies the deployment's own *.pages.dev URL, which that zone setting
    // does not cover, so a 403 is a real failure to verify and must say so.
    console.error(`Version check failed: ${res.status} ${res.statusText} from ${versionUrl}`)
    if (res.status === 403) {
      console.error('  The request was blocked before reaching the API (Cloudflare Access, WAF or Bot Fight Mode).')
      console.error('  Verify against the deployment URL (https://<id>.qesto.pages.dev), or set')
      console.error('  CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET if the origin is behind Access.')
    }
    process.exit(1)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const bodyText = await res.text()
    if (bodyText.toLowerCase().includes('cloudflare access') || bodyText.toLowerCase().includes('sign in')) {
      console.error('Version endpoint is behind Cloudflare Access or returned an auth page, not JSON.')
      console.error(`URL checked: ${versionUrl}`)
      process.exit(4)
    }
    console.error(`Expected JSON but got content-type: ${contentType || 'unknown'}`)
    process.exit(1)
  }

  const body = await res.json()
  const remote = body?.data?.commit ?? 'unknown'
  const env = body?.data?.env ?? 'unknown'

  console.log(`Local commit : ${local}`)
  console.log(`Remote commit: ${remote}`)
  console.log(`Remote env   : ${env}`)
  console.log(`Version URL  : ${versionUrl}`)

  if (local === 'unknown' || remote === 'unknown') {
    console.log('Result       : unknown (missing commit metadata)')
    exitCode = 2
  } else if (local.slice(0, 12) !== remote.slice(0, 12)) {
    // The Worker reports a 12-char SHA; Pages builds report up to the full 40.
    console.error('Result       : mismatch')
    exitCode = 3
  } else {
    console.log('Result       : match')
  }
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error)
  console.error(`Deploy verification failed: ${msg}`)
  process.exit(1)
}

// ── Step 1b: Platform binding probe (when health exposes bindings) ─────────
try {
  const healthUrl = `${origin}/api/admin/health`
  const healthRes = await fetch(healthUrl, {
    headers: { accept: 'application/json', ...cfAccessHeaders },
  })
  if (healthRes.ok) {
    const health = await healthRes.json()
    const bindings = health?.data?.bindings
    const decision = bindingProbeDecision(bindings?.missingRequired)
    if (decision.action === 'fail') {
      console.error(`✗ Required bindings missing: ${decision.missing.join(', ')}`)
      exitCode = exitCode || 5
    } else if (decision.action === 'warn') {
      console.warn(`⚠ Required bindings missing: ${decision.missing.join(', ')} (set SMOKE_REQUIRE_BINDINGS=1 to fail on this)`)
    } else if (bindings?.probes) {
      console.log('Bindings     : OK (required probes present)')
    }
  } else {
    console.warn(`⚠ Binding probe skipped (health HTTP ${healthRes.status})`)
  }
} catch (err) {
  console.warn(`⚠ Binding probe skipped: ${err instanceof Error ? err.message : String(err)}`)
}

// ── Step 2: Static asset MIME type checks ─────────────────────────────────
// Verifies that JS and CSS assets are NOT served as text/html (SPA fallback bug).
// Asset filenames are read from the built dist/index.html so this always checks
// the actual deployed files, regardless of Vite content-hash changes.
console.log('\nAsset MIME checks:')
const assets = parseDistAssets()

const mimeChecks = []

if (assets.js) {
  mimeChecks.push(checkAssetMime(`${origin}${assets.js}`, 'javascript', 'JS entry', cfAccessHeaders))
} else {
  console.warn('  Could not find JS entry in dist/index.html — skipping JS MIME check')
}

if (assets.css) {
  mimeChecks.push(checkAssetMime(`${origin}${assets.css}`, 'text/css', 'CSS', cfAccessHeaders))
} else {
  console.warn('  Could not find CSS asset in dist/index.html — skipping CSS MIME check')
}

const mimeResults = await Promise.all(mimeChecks)
const mimeOk = mimeResults.every(Boolean)

if (!mimeOk) {
  console.error('\n✗ Asset MIME check failed — assets may be served as HTML (SPA fallback).')
  console.error('  Ensure all dist/ files were included in the Cloudflare Pages upload.')
  exitCode = exitCode || 1
} else if (mimeResults.length > 0) {
  console.log('\n✓ Asset MIME types correct')
}

process.exit(exitCode)
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) {
  await main()
}
