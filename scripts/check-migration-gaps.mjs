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

// Get distinct migration base names (collapsing .verify.sql/.meta.toml companions).
const bases = new Set()
const filesByNum = new Map()

for (const f of readdirSync(migrationsDir)) {
  if (!/^\d{4}_/.test(f)) continue
  if (!(f.endsWith('.sql') || f.endsWith('.meta.toml'))) continue

  const base = f
    .replace(/\.verify\.sql$/, '')
    .replace(/\.sql$/, '')
    .replace(/\.meta\.toml$/, '')
  bases.add(base)

  const n = parseInt(f.split('_')[0], 10)
  if (!filesByNum.has(n)) {
    filesByNum.set(n, [])
  }
  if (!filesByNum.get(n).includes(base)) {
    filesByNum.get(n).push(base)
  }
}

// Check for duplicate migration numbers (true collisions, not companions)
let failed = false
for (const [num, baseNames] of filesByNum.entries()) {
  if (baseNames.length > 1) {
    console.error(`❌ Migration collision: ${num} has multiple distinct migrations: ${baseNames.join(', ')}`)
    failed = true
  }
}

// Check for gaps in sequence
const numbers = [...filesByNum.keys()].sort((a, b) => a - b)
for (let i = 0; i < numbers.length; i++) {
  const expected = i === 0 ? numbers[0] : numbers[i - 1] + 1
  if (numbers[i] !== expected) {
    console.error(`❌ Migration gap: expected ${String(expected).padStart(4, '0')} but found ${String(numbers[i]).padStart(4, '0')}`)
    failed = true
  }
}

if (failed) {
  console.error('See #407 (schema drift) and #530 (duplicate numbers) for context.')
  process.exit(1)
}

console.log(`✅ Migration sequence is contiguous (${bases.size} distinct migrations, 0000–${String(numbers[numbers.length-1]).padStart(4,'0')})`)
