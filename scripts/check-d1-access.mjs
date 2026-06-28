#!/usr/bin/env node
/**
 * check-d1-access.mjs
 * CI ratchet (ADR-0069): D1 queries belong in the repository layer
 * (`functions/api/repositories/`), not inline in route handlers. Direct
 * `env.DB.prepare(...)` calls inside `functions/api/routes/` are counted; the
 * build fails if the count exceeds the recorded baseline, so the debt can only
 * shrink. Lower BASELINE as you move queries into repositories.
 *
 * Multiline-aware: counts `env.DB.prepare` even when written as
 * `c.env.DB\n  .prepare(...)` (the common style), which a line-by-line scan
 * would miss. Scans full file content, not individual lines.
 *
 * See REFACTORING_AUDIT.md (High: "D1 access is overwhelmingly inline").
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, relative, join } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
// Only routes are scanned — repositories/ are the intended home for prepare().
const SCAN_DIR = resolve(ROOT, 'functions/api/routes')
const ALLOWED = new Set()
// `\s*` spans the newline in `c.env.DB\n.prepare(...)`.
const PATTERN = /\benv\.DB\s*\.\s*prepare\b/g

// Current known violations. Ratchet DOWN only — never raise this.
// Burn down by extracting queries into functions/api/repositories/.
// 329 after the sessions/lifecycle.ts extraction (first repository slice, ADR-0069).
const BASELINE = 329

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
  const content = readFileSync(file, 'utf8')
  PATTERN.lastIndex = 0
  let m
  while ((m = PATTERN.exec(content)) !== null) {
    const line = content.slice(0, m.index).split('\n').length
    const text = (content.split('\n')[line - 1] ?? '').trim().slice(0, 100)
    violations.push({ file: relative(ROOT, file), line, text })
  }
}

const total = violations.length

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
