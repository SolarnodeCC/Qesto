#!/usr/bin/env node
/**
 * check-migration-gaps.mjs
 * CI guard: fails if migration/ directory has sequence gaps.
 * Add to package.json scripts and call in CI before deploy.
 * See TECH_DEBT_AUDIT_2026-05.md TD-03.
 */
import { readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, '..', 'migrations')

const files = readdirSync(migrationsDir)
  // `.verify.sql` files are post-apply verification companions to a migration
  // (they share its NNNN prefix); they are not migrations themselves and must
  // not be counted as separate sequence entries (#530).
  .filter(f => f.endsWith('.sql') && !f.endsWith('.verify.sql'))
  .map(f => {
    const n = parseInt(f.split('_')[0], 10)
    if (isNaN(n)) throw new Error(`Migration filename has no numeric prefix: ${f}`)
    return { n, f }
  })
  .sort((a, b) => a.n - b.n)

let failed = false

for (let i = 0; i < files.length; i++) {
  const expected = i === 0 ? files[0].n : files[i - 1].n + 1
  if (files[i].n !== expected) {
    console.error(`❌ Migration gap: expected ${String(expected).padStart(4, '0')} but found ${files[i].f}`)
    failed = true
  }
}

if (failed) {
  console.error('\nFix: add reconciliation no-op migrations for each missing number.')
  console.error('See TECH_DEBT_AUDIT_2026-05.md TD-03 for instructions.')
  process.exit(1)
}

console.log(`✅ Migration sequence is contiguous (${files.length} files, 0000–${String(files[files.length-1].n).padStart(4,'0')})`)
