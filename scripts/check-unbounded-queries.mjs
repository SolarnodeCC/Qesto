#!/usr/bin/env node
/**
 * check-unbounded-queries.mjs
 * CI ratchet (DD-14, issue #887): D1 `.all()` reads whose SQL has no LIMIT
 * return every matching row, so response time and Worker CPU grow linearly
 * with tenant data — the largest customers degrade first, and a free account
 * can loop an unbounded list as an economic DoS.
 *
 * Counts `.all(` / `.all<` call sites under functions/ whose preceding
 * `prepare(...)` SQL (same call chain) contains no LIMIT. Fails if the count
 * rises above BASELINE, so the debt can only shrink. Paginate new list
 * endpoints with lib/pagination.ts (keyset) instead of raising this.
 *
 * Heuristic, on purpose: a chain whose SQL is built elsewhere (a variable) is
 * counted unless the variable's text is visible in the window and has LIMIT.
 *
 * Usage: node scripts/check-unbounded-queries.mjs [--list]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const SCAN_DIR = resolve(ROOT, 'functions')
const WINDOW = 1500 // chars to look back for the prepare( that starts this chain

// Ratchet DOWN only. Measured when this gate landed (RT-2026-10).
const BASELINE = 86

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.ts') && !full.endsWith('.test.ts')) out.push(full)
  }
  return out
}

const ALL_CALL = /\.all\s*[<(]/g
const offenders = []
for (const file of walk(SCAN_DIR)) {
  const content = readFileSync(file, 'utf8')
  ALL_CALL.lastIndex = 0
  let m
  while ((m = ALL_CALL.exec(content)) !== null) {
    const before = content.slice(Math.max(0, m.index - WINDOW), m.index)
    const p = before.lastIndexOf('prepare(')
    if (p === -1) continue // not a D1 chain (e.g. Promise.all)
    const chain = before.slice(p)
    // Another statement boundary between prepare( and .all means a different chain.
    if (/\n\s*\n/.test(chain) && !/\.bind\(/.test(chain)) continue
    if (/\bLIMIT\b/i.test(chain)) continue
    const line = content.slice(0, m.index).split('\n').length
    offenders.push(`${relative(ROOT, file)}:${line}`)
  }
}

if (process.argv.includes('--list')) for (const o of offenders) console.log(o)

const total = offenders.length
if (total > BASELINE) {
  console.error(`❌ Unbounded D1 .all() reads increased: ${total} (baseline ${BASELINE}).`)
  console.error('   Add a LIMIT or paginate with functions/api/lib/pagination.ts. Run with --list to see them.')
  process.exit(1)
}
if (total < BASELINE) {
  console.log(`✅ Unbounded D1 .all() reads down to ${total} (baseline ${BASELINE}). Lower BASELINE in scripts/check-unbounded-queries.mjs to lock in the win.`)
} else {
  console.log(`✅ Unbounded D1 .all() reads at baseline (${total}). No regression.`)
}
