#!/usr/bin/env node
/**
 * check-no-any.mjs
 * CI ratchet: `: any` type annotations in functions/ are escape hatches that
 * defeat the strict compiler on (often) security- or AI-pipeline-adjacent
 * paths. Counts them and fails if the count exceeds the recorded baseline, so
 * the total can only shrink. Lower BASELINE as you replace `any` with
 * `unknown` + type guards.
 *
 * See FUTURE_READY_REVIEW_2026-06.md R-04.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, relative, join } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const SCAN_DIR = resolve(ROOT, 'functions')
const PATTERN = /:\s*any\b/g

// Current known annotations. Ratchet DOWN only — never raise this.
const BASELINE = 34

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.ts')) out.push(full)
  }
  return out
}

// Skip prose like "// residual risk: any holder of a cookie" — `: any` followed
// immediately by whitespace + a lowercase word is English, not a type.
function isProse(line, matchIndex) {
  const after = line.slice(matchIndex).replace(/:\s*any\b/, '')
  return /^\s+[a-z]/.test(after)
}

const violations = []
for (const file of walk(SCAN_DIR)) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    let m
    PATTERN.lastIndex = 0
    while ((m = PATTERN.exec(line)) !== null) {
      if (isProse(line, m.index)) continue
      violations.push({ file: relative(ROOT, file), line: i + 1, text: line.trim().slice(0, 100) })
    }
  })
}

const total = violations.length

if (total > BASELINE) {
  console.error(`❌ '\: any' annotations increased: ${total} (baseline ${BASELINE}).`)
  console.error('   Replace new `any` with `unknown` + a type guard.\n')
  for (const v of violations) console.error(`   ${v.file}:${v.line}  ${v.text}`)
  process.exit(1)
}

if (total < BASELINE) {
  console.log(`✅ ': any' annotations down to ${total} (baseline ${BASELINE}). Lower BASELINE in scripts/check-no-any.mjs to lock in the win.`)
} else {
  console.log(`✅ ': any' annotations at baseline (${total}). No regression.`)
}
