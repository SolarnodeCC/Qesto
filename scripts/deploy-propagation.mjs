#!/usr/bin/env node
/**
 * A direct-upload Pages deployment reports "complete" before its
 * https://<id>.qesto.pages.dev alias is routed. The first requests then come
 * back 404 (sometimes 502/503) even though the upload succeeded. Post-deploy
 * checks have to wait that out; a 403 is a block, not propagation, and is
 * returned immediately.
 *
 * CLI (stdout is the response body only, so it can be captured):
 *   node scripts/deploy-propagation.mjs <url>
 */
import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Cloudflare's "deployment not attached yet" answers, plus the usual gateway
// timeouts. 401/403 are decisions, not propagation.
export const TRANSIENT_DEPLOY_STATUSES = new Set([
  404, 408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524,
])

export function isTransientDeployStatus(status) {
  return TRANSIENT_DEPLOY_STATUSES.has(status)
}

// Once any request in this process has been served, the alias is routed and
// later checks (asset MIME, the next smoke URL) should fail fast.
let deploymentIsRouted = false

export function resetDeployPropagation() {
  deploymentIsRouted = false
}

function envNumber(name, fallback) {
  const raw = Number(process.env[name])
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback
}

async function drain(res) {
  try {
    if (res.body && typeof res.body.cancel === 'function') {
      await res.body.cancel()
      return
    }
    await res.arrayBuffer()
  } catch {
    // Discarded so the connection can be reused for the next attempt.
  }
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 * @param {{
 *   fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>,
 *   sleep?: (ms: number) => Promise<void>,
 *   budgetMs?: number,
 *   delayMs?: number,
 *   maxAttempts?: number,
 *   now?: () => number,
 *   log?: (message: string) => void,
 * }} [options]
 */
export async function fetchUntilDeployed(url, init = {}, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  const budgetMs = options.budgetMs ?? envNumber('DEPLOY_READY_BUDGET_MS', 90_000)
  const delayMs = options.delayMs ?? envNumber('DEPLOY_READY_DELAY_MS', 2_000)
  const maxAttempts = options.maxAttempts ?? 40
  const now = options.now ?? Date.now
  const log = options.log ?? ((message) => console.warn(message))
  const retry = !deploymentIsRouted

  if (!retry) return fetchImpl(url, { redirect: 'follow', ...init })

  const started = now()
  let attempt = 0
  for (;;) {
    attempt += 1
    const attemptInit = { redirect: 'follow', ...init }
    if (!init.signal && typeof AbortSignal?.timeout === 'function') {
      attemptInit.signal = AbortSignal.timeout(15_000)
    }
    try {
      const res = await fetchImpl(url, attemptInit)
      if (res.ok) {
        deploymentIsRouted = true
        return res
      }
      const giveUp =
        !isTransientDeployStatus(res.status) || now() - started >= budgetMs || attempt >= maxAttempts
      if (giveUp) return res
      log(
        `  ${url} → HTTP ${res.status} (attempt ${attempt}); a fresh Pages deployment can 404 until its alias is routed. Retrying.`,
      )
      await drain(res)
    } catch (error) {
      if (now() - started >= budgetMs || attempt >= maxAttempts) throw error
      const message = error instanceof Error ? error.message : String(error)
      log(`  ${url} → network error (attempt ${attempt}): ${message}. Retrying.`)
    }
    await sleep(delayMs)
  }
}

async function main() {
  const url = process.argv[2]
  if (!url) {
    console.error('Usage: node scripts/deploy-propagation.mjs <url>')
    process.exit(2)
  }
  const res = await fetchUntilDeployed(url, { headers: { accept: 'application/json' } })
  const text = await res.text()
  if (!res.ok) {
    console.error(`GET ${url} failed: ${res.status} ${res.statusText}`)
    if (text) console.error(text.slice(0, 500))
    process.exit(1)
  }
  process.stdout.write(text)
}

function invokedDirectly() {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href
  } catch {
    return false
  }
}

if (invokedDirectly()) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`deploy-propagation: ${message}`)
    process.exit(1)
  })
}
