#!/usr/bin/env node
/**
 * check-test-traceability.mjs
 * CI ratchet: every test file should say WHICH REQUIREMENT it proves.
 *
 * A test without a requirement reference is an assertion without an owner: on
 * failure nobody can tell whether the behaviour changed on purpose (update the
 * test) or by accident (fix the code), and a requirement that loses its last
 * test disappears silently. The convention is one header docblock per test
 * file naming the source of truth:
 *
 *   /**
 *    * Requirement: ADR-0073 §3 — rate limits fail closed when KV is down.
 *    * ...why this test exists, in prose, when it is not obvious.
 *    *\/
 *
 * Accepted references (anywhere in the file's header region, see HEAD_CHARS):
 *   - an ADR id                      ADR-0073
 *   - a specification document       SPEC_REALTIME §4
 *   - a knowledge-base path          knowledge-base/quality/testing/QA_FULL.md
 *   - a backlog / review / audit id  TOWNHALL-SCALE-PROOF-50K-01, REV-10, HLT-010
 *   - a GitHub issue                 issue #688
 *
 * Counts the files WITHOUT such a reference and fails if the count exceeds the
 * recorded baseline, so the debt can only shrink. Lower BASELINE whenever you
 * backfill headers — never raise it to make a build pass.
 *
 * Usage:
 *   node scripts/check-test-traceability.mjs            # ratchet (CI)
 *   node scripts/check-test-traceability.mjs --list     # name the untraced files
 *   node scripts/check-test-traceability.mjs --report   # per-lane coverage table
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, relative, join } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const TESTS_DIR = resolve(ROOT, 'tests')

// Count of test files with no requirement reference in their header. The
// backfill in RT-2026-09 took this to zero, so the ratchet now doubles as a
// hard gate for new test files. Ratchet DOWN only — never raise this.
const BASELINE = 0

// How much of the file counts as "the header". Generous enough to survive a
// license banner plus imports, tight enough that an ADR id buried in an
// assertion 400 lines down does not count as documentation.
const HEAD_CHARS = 1500

const REFERENCE_PATTERNS = [
  /\bADR-\d{2,4}\b/, // numbered architecture decision record
  /\bADR-[A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*\b/, // named ADR (ADR-KV-Tenant-Conventions)
  /\bSPEC_[A-Z_]+\b/, // specification document
  /\bknowledge-base\/[A-Za-z0-9_\-/]+\.md\b/, // any KB document
  /\bBACKLOG_[A-Z_]+\b/,
  /\b[A-Z][A-Z0-9]{1,14}(?:-[A-Z0-9]{1,14})*-\d{1,3}\b/, // story / review / audit ids
  /\bissues?\s+#\d+/i, // issue #688
  /\(#\d+\)/, // (#864)
]

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (/\.(test|spec)\.tsx?$/.test(entry)) acc.push(full)
  }
  return acc
}

function hasReference(header) {
  return REFERENCE_PATTERNS.some((p) => p.test(header))
}

const files = walk(TESTS_DIR).sort()
const untraced = []
const perLane = new Map()

for (const file of files) {
  const rel = relative(ROOT, file)
  const lane = relative(TESTS_DIR, file).split('/')[0]
  const traced = hasReference(readFileSync(file, 'utf8').slice(0, HEAD_CHARS))
  const lanes = perLane.get(lane) ?? { total: 0, traced: 0 }
  lanes.total += 1
  if (traced) lanes.traced += 1
  else untraced.push(rel)
  perLane.set(lane, lanes)
}

const args = new Set(process.argv.slice(2))

if (args.has('--report')) {
  console.log('lane          files   traced   untraced')
  for (const [lane, s] of [...perLane].sort()) {
    console.log(
      lane.padEnd(12) +
        String(s.total).padStart(6) +
        String(s.traced).padStart(9) +
        String(s.total - s.traced).padStart(11),
    )
  }
}

if (args.has('--list')) {
  for (const file of untraced) console.log(file)
}

const count = untraced.length
const traced = files.length - count

if (count > BASELINE) {
  console.error(
    `❌ Test files without a requirement reference rose to ${count} (baseline ${BASELINE}).\n` +
      `   Add a header docblock naming the requirement (ADR / SPEC / story id / issue) to:\n` +
      untraced
        .slice(0, 20)
        .map((f) => `     - ${f}`)
        .join('\n') +
      (count > 20 ? `\n     … run with --list for the full set.` : '') +
      `\n   See knowledge-base/quality/testing/QA_FULL.md §5 for the convention.`,
  )
  process.exit(1)
}

if (count < BASELINE) {
  console.log(
    `✅ Test requirement traceability improved: ${traced}/${files.length} files traced, ` +
      `${count} untraced (baseline ${BASELINE}). Lower BASELINE in scripts/check-test-traceability.mjs to lock in the win.`,
  )
} else {
  console.log(
    `✅ Test requirement traceability at baseline: ${traced}/${files.length} files traced, ${count} untraced.`,
  )
}
