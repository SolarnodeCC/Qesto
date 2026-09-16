#!/usr/bin/env node
/**
 * check-lint-baseline.mjs
 * CI ratchet: ESLint errors may only shrink.
 *
 * The repo had no linter at all until RT-2026-09, so turning ESLint on as a
 * hard gate would have meant fixing 132 pre-existing errors in the same PR that
 * introduced it. Instead this follows the same ratchet idiom as
 * check-kv-access.mjs / check-d1-access.mjs: record the debt, fail when it
 * grows, and lower the baseline as call sites are fixed.
 *
 * The baseline is PER RULE, not a single total, so a fixed `no-useless-escape`
 * cannot silently pay for a new `react-hooks/rules-of-hooks`. A rule that is
 * absent from the map has a baseline of 0 — any first occurrence fails.
 *
 * Warnings are reported but never gate (see `react-hooks/exhaustive-deps`).
 */
import { ESLint } from 'eslint'

// Current known violations, per rule. Ratchet DOWN only — never raise a number
// here to make a build pass. Fix the code, then lower the entry (and delete it
// when it reaches 0).
//
// The react-hooks entries are the ones worth burning down first: they are
// genuine runtime-correctness bugs, not style. In particular
// `rules-of-hooks` (conditional useMemo in src/pages/Dashboard.tsx) can break
// on re-render, and `refs`/`purity` flag reads during render in
// src/hooks/useLiveSession.ts and useInsights.ts — the live WebSocket path.
const BASELINE = {
  'react-hooks/set-state-in-effect': 59,
  'no-useless-assignment': 15,
  '@typescript-eslint/no-unused-vars': 14,
  'no-control-regex': 6,
  'react-hooks/refs': 5,
  'no-useless-escape': 4,
  'preserve-caught-error': 4,
  'react-hooks/purity': 4,
  '@typescript-eslint/no-require-imports': 4,
  'no-undef': 4,
  'prefer-const': 3,
  'react-hooks/immutability': 3,
  'react-hooks/rules-of-hooks': 2,
  'no-irregular-whitespace': 2,
  '@typescript-eslint/no-unsafe-function-type': 1,
  '@typescript-eslint/no-this-alias': 1,
}

const eslint = new ESLint()
const results = await eslint.lintFiles(['.'])

/** @type {Record<string, number>} */
const counts = {}
/** @type {Record<string, {file: string, line: number, message: string}[]>} */
const samples = {}
let warnings = 0

for (const result of results) {
  for (const m of result.messages) {
    if (m.severity !== 2) {
      warnings++
      continue
    }
    const rule = m.ruleId ?? '(parse error)'
    counts[rule] = (counts[rule] ?? 0) + 1
    ;(samples[rule] ??= []).push({
      file: result.filePath.replace(`${process.cwd()}/`, ''),
      line: m.line,
      message: m.message.split('\n')[0].slice(0, 110),
    })
  }
}

const rules = [...new Set([...Object.keys(BASELINE), ...Object.keys(counts)])].sort()
const grown = []
const shrunk = []

for (const rule of rules) {
  const now = counts[rule] ?? 0
  const was = BASELINE[rule] ?? 0
  if (now > was) grown.push({ rule, now, was })
  else if (now < was) shrunk.push({ rule, now, was })
}

const total = Object.values(counts).reduce((a, b) => a + b, 0)
const baselineTotal = Object.values(BASELINE).reduce((a, b) => a + b, 0)

if (grown.length > 0) {
  console.error(`❌ ESLint errors increased: ${total} (baseline ${baselineTotal}).\n`)
  for (const g of grown) {
    console.error(`   ${g.rule}: ${g.now} (baseline ${g.was})`)
    for (const s of (samples[g.rule] ?? []).slice(0, 10)) {
      console.error(`     ${s.file}:${s.line}  ${s.message}`)
    }
    console.error('')
  }
  console.error('   Fix the new violations. Do not raise the baseline.')
  process.exit(1)
}

if (shrunk.length > 0) {
  console.log(`✅ ESLint errors down to ${total} (baseline ${baselineTotal}).`)
  for (const s of shrunk) {
    console.log(`   ${s.rule}: ${s.now} (baseline ${s.was}) — lower it in scripts/check-lint-baseline.mjs to lock in the win.`)
  }
} else {
  console.log(`✅ ESLint at baseline (${total} errors, ${warnings} warnings). No regression.`)
}
