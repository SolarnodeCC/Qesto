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

// wrangler applies every *.sql file in the directory in lexicographic order;
// it does not require one file per number. Convention here is N:1 (a numeric
// prefix can carry a `.sql` + a `.verify.sql` companion, or two independent
// features that landed in the same window), so gaps are checked on the set of
// *distinct* numeric prefixes, not on the raw file count.
const numbers = [...new Set(
  readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .map(f => {
      const n = parseInt(f.split('_')[0], 10)
      if (isNaN(n)) throw new Error(`Migration filename has no numeric prefix: ${f}`)
      return n
    }),
)].sort((a, b) => a - b)

let failed = false

for (let i = 1; i < numbers.length; i++) {
  const expected = numbers[i - 1] + 1
  if (numbers[i] !== expected) {
    console.error(`❌ Migration gap: expected ${String(expected).padStart(4, '0')} but found ${String(numbers[i]).padStart(4, '0')}`)
    failed = true
  }
}

if (failed) {
  console.error('\nFix: add reconciliation no-op migrations for each missing number.')
  console.error('See TECH_DEBT_AUDIT_2026-05.md TD-03 for instructions.')
  process.exit(1)
}

console.log(`✅ Migration sequence is contiguous (${numbers.length} distinct numbers, 0000–${String(numbers[numbers.length-1]).padStart(4,'0')})`)
