// #530 — migration sequence hygiene. Mirrors ops/ci/check-migration-numbers.sh
// and scripts/check-migration-gaps.mjs so a duplicate or gap is caught by the
// fast unit suite, not just the deploy pipeline. Duplicate 4-digit prefixes make
// D1 apply migrations in an undefined order and silently skip one → schema drift.

import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const migrationsDir = join(__dirname, '..', '..', 'migrations')

/** Distinct migration base names (NNNN_name), collapsing .sql/.verify.sql/.meta.toml companions. */
function migrationBaseNames(): string[] {
  const bases = new Set<string>()
  for (const f of readdirSync(migrationsDir)) {
    if (!/^\d{4}_/.test(f)) continue
    if (!(f.endsWith('.sql') || f.endsWith('.meta.toml'))) continue
    const base = f
      .replace(/\.verify\.sql$/, '')
      .replace(/\.sql$/, '')
      .replace(/\.meta\.toml$/, '')
    bases.add(base)
  }
  return [...bases]
}

describe('migration numbering (#530)', () => {
  it('has no duplicate 4-digit prefixes across distinct migrations', () => {
    const byNumber = new Map<string, string[]>()
    for (const base of migrationBaseNames()) {
      const num = base.slice(0, 4)
      byNumber.set(num, [...(byNumber.get(num) ?? []), base])
    }
    const collisions = [...byNumber.entries()].filter(([, names]) => names.length > 1)
    expect(collisions, `duplicate migration prefixes: ${JSON.stringify(collisions)}`).toEqual([])
  })

  it('has a contiguous, gap-free sequence starting at 0000', () => {
    const numbers = [...new Set(migrationBaseNames().map((b) => parseInt(b.slice(0, 4), 10)))].sort(
      (a, b) => a - b,
    )
    expect(numbers[0]).toBe(0)
    for (let i = 1; i < numbers.length; i++) {
      expect(numbers[i], `gap before ${String(numbers[i]).padStart(4, '0')}`).toBe(numbers[i - 1] + 1)
    }
  })
})
