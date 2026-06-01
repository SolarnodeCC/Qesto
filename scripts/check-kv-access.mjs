#!/usr/bin/env node
/**
 * check-kv-access.mjs
 * CI ratchet: every KV namespace access should go through the `lib/kv.ts`
 * abstraction (TTL policy, serialization, error handling). Direct
 * `env.<NS>_KV.<op>(...)` calls outside that module are counted; the build
 * fails if the count exceeds the recorded baseline, so the debt can only
 * shrink. Lower BASELINE as you migrate call sites.
 *
 * See FUTURE_READY_REVIEW_2026-06.md R-02.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, relative, join } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const SCAN_DIR = resolve(ROOT, 'functions')
const ALLOWED = new Set([resolve(ROOT, 'functions/api/lib/kv.ts')])
const PATTERN = /\benv\.[A-Z_]+_KV\./g

// Current known violations. Ratchet DOWN only — never raise this.
const BASELINE = 50

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.ts')) out.push(full)
  }
  return out
}

const violations = []
for (const file of walk(SCAN_DIR)) {
  if (ALLOWED.has(file)) continue
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    const matches = line.match(PATTERN)
    if (matches) violations.push({ file: relative(ROOT, file), line: i + 1, count: matches.length, text: line.trim().slice(0, 100) })
  })
}

const total = violations.reduce((n, v) => n + v.count, 0)

if (total > BASELINE) {
  console.error(`❌ Direct KV access increased: ${total} (baseline ${BASELINE}).`)
  console.error('   New direct `env.*_KV.*` calls must go through lib/kv.ts.\n')
  for (const v of violations) console.error(`   ${v.file}:${v.line}  ${v.text}`)
  process.exit(1)
}

if (total < BASELINE) {
  console.log(`✅ Direct KV access down to ${total} (baseline ${BASELINE}). Lower BASELINE in scripts/check-kv-access.mjs to lock in the win.`)
} else {
  console.log(`✅ Direct KV access at baseline (${total}). No regression.`)
}
