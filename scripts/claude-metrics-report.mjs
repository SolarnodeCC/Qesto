#!/usr/bin/env node
/**
 * claude-metrics-report.mjs
 * Summarizes .claude/metrics/sessions.jsonl (written by the session-metrics Stop
 * hook) into a human-readable activity report: session count, files/lines
 * touched, and a per-branch breakdown.
 *
 * Usage: node scripts/claude-metrics-report.mjs
 * Observability only — exits 0 even when there is no data yet.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = resolve(ROOT, '.claude/metrics/sessions.jsonl')

if (!existsSync(FILE)) {
  console.log('No session metrics yet — the session-metrics Stop hook writes .claude/metrics/sessions.jsonl after the first session ends.')
  process.exit(0)
}

const rows = readFileSync(FILE, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => { try { return JSON.parse(l) } catch { return null } })
  .filter(Boolean)

if (!rows.length) { console.log('Session metrics file is empty.'); process.exit(0) }

const sum = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)
const byBranch = {}
for (const r of rows) {
  const b = r.branch || 'unknown'
  byBranch[b] = byBranch[b] || { sessions: 0, insertions: 0, deletions: 0 }
  byBranch[b].sessions++
  byBranch[b].insertions += Number(r.insertions) || 0
  byBranch[b].deletions += Number(r.deletions) || 0
}

console.log('\nClaude Code — session activity')
console.log('────────────────────────────────')
console.log(`Sessions recorded : ${rows.length}`)
console.log(`First / last      : ${rows[0].ts} → ${rows[rows.length - 1].ts}`)
console.log(`Lines added       : +${sum('insertions')}`)
console.log(`Lines removed     : -${sum('deletions')}`)
console.log(`TS/TSX touches    : ${sum('ts_files')}`)
console.log('\nBy branch:')
for (const [b, s] of Object.entries(byBranch).sort((a, c) => c[1].sessions - a[1].sessions)) {
  console.log(`  ${b.padEnd(28)} ${String(s.sessions).padStart(3)} sessions  +${s.insertions}/-${s.deletions}`)
}
console.log('')
