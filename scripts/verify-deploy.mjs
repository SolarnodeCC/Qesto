#!/usr/bin/env node
import { execSync } from 'node:child_process'

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

const local = localCommit()
const versionUrl = `${baseUrl.replace(/\/$/, '')}/api/version`

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
    process.exit(2)
  }

  if (local !== remote) {
    console.error('Result       : mismatch')
    process.exit(3)
  }

  console.log('Result       : match')
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error)
  console.error(`Deploy verification failed: ${msg}`)
  process.exit(1)
}
