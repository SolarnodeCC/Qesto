#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const baseUrl = process.argv[2] ?? process.env.APP_URL

if (!baseUrl) {
  console.error('Usage: npm run verify:deploy -- <base-url>')
  console.error('Example: npm run verify:deploy -- https://qesto2-github.oostelaar.workers.dev')
  process.exit(1)
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

async function checkAssetMime(url, expectedType, label) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
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

const local = localCommit()
const origin = baseUrl.replace(/\/$/, '')
const versionUrl = `${origin}/api/version`

let exitCode = 0

// ── Step 1: API version / commit parity check ─────────────────────────────
try {
  const res = await fetch(versionUrl, {
    headers: { accept: 'application/json' },
    redirect: 'follow',
  })
  if (!res.ok) {
    console.error(`Health check failed: ${res.status} ${res.statusText}`)
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
  } else if (local !== remote) {
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

// ── Step 2: Static asset MIME type checks ─────────────────────────────────
// Verifies that JS and CSS assets are NOT served as text/html (SPA fallback bug).
// Asset filenames are read from the built dist/index.html so this always checks
// the actual deployed files, regardless of Vite content-hash changes.
console.log('\nAsset MIME checks:')
const assets = parseDistAssets()

const mimeChecks = []

if (assets.js) {
  mimeChecks.push(checkAssetMime(`${origin}${assets.js}`, 'javascript', 'JS entry'))
} else {
  console.warn('  Could not find JS entry in dist/index.html — skipping JS MIME check')
}

if (assets.css) {
  mimeChecks.push(checkAssetMime(`${origin}${assets.css}`, 'text/css', 'CSS'))
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
