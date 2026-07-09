#!/usr/bin/env node
/**
 * check-error-response.mjs
 * CI ratchet (ADR-0070): API error responses should be built with the
 * `errorResponse()` helper in `lib/error-handler.ts` (which applies
 * `sanitizeError` + trace_id consistently), not hand-rolled inline. Inline
 * `ok: false` envelopes inside `functions/api/routes/` are counted; the build
 * fails if the count exceeds the recorded baseline, so the debt can only
 * shrink. Lower BASELINE as you migrate call sites to errorResponse().
 *
 * See REFACTORING_AUDIT.md (Medium: "Error responses reinvented 610x").
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, relative, join } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const SCAN_DIR = resolve(ROOT, 'functions/api/routes')
const ALLOWED = new Set()
const PATTERN = /ok:\s*false/g

// Current known violations. Ratchet DOWN only — never raise this.
// Burn down by replacing inline envelopes with errorResponse(c, status, code, message).
// 610 at audit time; sovereign.ts migrated to errorResponse() (→603); marketplace
// connect/listings consolidated onto authorizeTeamPermission (→597); clean
// single-line envelopes across 23 route files codemodded to errorResponse() (→480);
// batch-2: 26 low-count route files migrated (→449); batch-3: 23 low-count route
// files codemodded (→347); batch-4: billing.ts migrated (→330).
// files migrated to errorResponse() (→347; captcha + denyFeature data/details-bearing
// envelopes preserved since errorResponse() carries only code+message).
const BASELINE = 325

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
  console.error(`❌ Inline error envelopes increased: ${total} (baseline ${BASELINE}).`)
  console.error('   New API errors must use errorResponse() from lib/error-handler.ts.\n')
  for (const v of violations) console.error(`   ${v.file}:${v.line}  ${v.text}`)
  process.exit(1)
}

if (total < BASELINE) {
  console.log(`✅ Inline error envelopes down to ${total} (baseline ${BASELINE}). Lower BASELINE in scripts/check-error-response.mjs to lock in the win.`)
} else {
  console.log(`✅ Inline error envelopes at baseline (${total}). No regression.`)
}
