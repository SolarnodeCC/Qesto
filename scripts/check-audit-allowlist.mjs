#!/usr/bin/env node
/**
 * DD-02 — turn `npm audit` into a real gate.
 *
 * Reads an `npm audit --json` report and fails unless every advisory at or
 * above the threshold is covered by a NON-EXPIRED entry in
 * ops/ci/audit-allowlist.json.
 *
 * An allowlist entry is a deliberate, dated risk acceptance — not a mute. An
 * entry whose `expires` date has passed fails the build just as loudly as an
 * unlisted advisory, so accepted risk cannot quietly become permanent.
 *
 * Usage: node scripts/check-audit-allowlist.mjs <npm-audit.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BLOCKING = new Set(['high', 'critical'])

const reportPath = process.argv[2]
if (!reportPath) {
  console.error('usage: check-audit-allowlist.mjs <npm-audit.json>')
  process.exit(2)
}

/** npm audit writes nothing on a clean tree in some versions — treat as pass. */
function readJson(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8').trim()
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const report = readJson(reportPath, { vulnerabilities: {} })
const allowlist = readJson(path.join(root, 'ops/ci/audit-allowlist.json'), { allow: [] })

const today = new Date().toISOString().slice(0, 10)
const allowed = new Map()
const expired = []
for (const entry of allowlist.allow ?? []) {
  if (!entry.name || !entry.expires) continue
  if (entry.expires < today) expired.push(entry)
  else allowed.set(entry.name, entry)
}

const blocking = []
for (const [name, v] of Object.entries(report.vulnerabilities ?? {})) {
  if (!BLOCKING.has(v.severity)) continue
  if (allowed.has(name)) continue
  blocking.push({ name, severity: v.severity, via: summariseVia(v.via) })
}

function summariseVia(via) {
  if (!Array.isArray(via)) return ''
  const titles = via.map((x) => (typeof x === 'string' ? x : x?.title)).filter(Boolean)
  return [...new Set(titles)].slice(0, 2).join('; ')
}

let failed = false

if (expired.length > 0) {
  failed = true
  console.error('\n✖ Expired audit-allowlist entries — re-assess or remediate:\n')
  for (const e of expired) {
    console.error(`  ${e.name}  expired ${e.expires}  (${e.reason ?? 'no reason recorded'})`)
  }
}

if (blocking.length > 0) {
  failed = true
  console.error(`\n✖ ${blocking.length} un-allowlisted high/critical advisory(ies):\n`)
  for (const b of blocking) {
    console.error(`  ${b.name}  [${b.severity}]  ${b.via}`)
  }
  console.error(
    '\nFix with `npm audit fix`, or add a dated entry to ops/ci/audit-allowlist.json\n' +
      'explaining why the risk is accepted and when it will be revisited.\n',
  )
}

if (failed) process.exit(1)

const n = allowed.size
console.log(`check:audit OK — no un-allowlisted high/critical advisories${n ? ` (${n} allowlisted)` : ''}`)
