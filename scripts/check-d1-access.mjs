#!/usr/bin/env node
/**
 * check-d1-access.mjs
 * CI ratchet (ADR-0069): D1 queries belong in the repository layer
 * (`functions/api/repositories/`), not inline in route handlers. Direct
 * `env.DB.prepare(...)` calls inside `functions/api/routes/` are counted; the
 * build fails if the count exceeds the recorded baseline, so the debt can only
 * shrink. Lower BASELINE as you move queries into repositories.
 *
 * See REFACTORING_AUDIT.md (High: "D1 access is overwhelmingly inline").
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, relative, join } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
// Only routes are scanned — repositories/ are the intended home for prepare().
const SCAN_DIR = resolve(ROOT, 'functions/api/routes')
const ALLOWED = new Set()
const PATTERN = /\benv\.DB\.prepare\b/g

// Current known violations. Ratchet DOWN only — never raise this.
// Burn down by extracting queries into functions/api/repositories/.
const BASELINE = 288

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
  console.error(`❌ Inline D1 access in routes increased: ${total} (baseline ${BASELINE}).`)
  console.error('   New D1 queries must live in functions/api/repositories/, not in route handlers.\n')
  for (const v of violations) console.error(`   ${v.file}:${v.line}  ${v.text}`)
  process.exit(1)
}

if (total < BASELINE) {
  console.log(`✅ Inline D1 access in routes down to ${total} (baseline ${BASELINE}). Lower BASELINE in scripts/check-d1-access.mjs to lock in the win.`)
} else {
  console.log(`✅ Inline D1 access in routes at baseline (${total}). No regression.`)
}
