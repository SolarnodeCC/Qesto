import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

const MIGRATIONS = join(process.cwd(), 'migrations')

const FLAGGED = [
  '0003_emoji_poll',
  '0004_quick_finger',
  '0005_team_quiz_word_cloud',
  '0006_fix_metrics_summary_columns',
  '0014_add_question_types',
  '0043_kb_vectors_storage',
  '0044_sessions_is_public',
  '0046_townhall',
  '0047_cross_session_insights',
  '0053_workspace_adr0048',
  '0057_add_reaction_question_kind',
  '0078_widen_session_mode',
]

// Destructive-SQL detection mirroring scripts/verify-migration-metadata.mjs, so
// this suite fails the same way the CI gate does when a destructive migration
// lands without its .meta.toml sidecar (regression guard for #689).
const DESTRUCTIVE_PATTERNS = [/drop\s+table/i, /truncate/i, /drop\s+column/i, /drop\s+constraint/i]

function executableSql(name: string): string {
  return readFileSync(join(MIGRATIONS, name), 'utf8')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

function metaContent(stem: string): string {
  const path = join(MIGRATIONS, `${stem}.meta.toml`)
  expect(existsSync(path), `${stem}.meta.toml should exist`).toBe(true)
  return readFileSync(path, 'utf8').toLowerCase()
}

describe('migration safety metadata (HLT-021/HLT-030)', () => {
  it.each(FLAGGED)('%s has jankurai-readable .meta.toml sidecar', (stem) => {
    const meta = metaContent(stem)
    expect(meta).toContain('owner')
    expect(meta).toMatch(/approval|approved/)
    expect(meta).toContain('rollback')
    expect(meta).toMatch(/backup|restore/)
    expect(meta).toContain('lock_timeout')
    expect(meta).toContain('statement_timeout')
    expect(meta).toMatch(/verify|verification/)
  })

  it('destructive migrations have verify.sql sidecars', () => {
    for (const stem of ['0003_emoji_poll', '0004_quick_finger', '0005_team_quiz_word_cloud', '0014_add_question_types']) {
      expect(existsSync(join(MIGRATIONS, `${stem}.verify.sql`))).toBe(true)
    }
  })

  it('0006 re-enables FK checks after PRAGMA foreign_keys=OFF', () => {
    const sql = readFileSync(join(MIGRATIONS, '0006_fix_metrics_summary_columns.sql'), 'utf8').toLowerCase()
    expect(sql).toContain('pragma foreign_keys = on')
    expect(sql).toContain('foreign_key_check')
    expect(sql).toContain('quick_check')
  })

  it('every destructive migration has a .meta.toml sidecar (#689)', () => {
    const missing: string[] = []
    for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && !f.endsWith('.verify.sql'))) {
      const sql = executableSql(file)
      if (!DESTRUCTIVE_PATTERNS.some((re) => re.test(sql))) continue
      const stem = file.replace(/\.sql$/, '')
      if (!existsSync(join(MIGRATIONS, `${stem}.meta.toml`))) missing.push(file)
    }
    expect(missing, `destructive migrations missing meta.toml: ${missing.join(', ')}`).toEqual([])
  })

  it('0057 and 0078 re-check integrity after their FK-off / DROP rebuild (#689)', () => {
    for (const stem of ['0057_add_reaction_question_kind', '0078_widen_session_mode']) {
      const sql = readFileSync(join(MIGRATIONS, `${stem}.sql`), 'utf8').toLowerCase()
      expect(sql).toContain('foreign_key_check')
      expect(sql).toContain('quick_check')
    }
  })

  it('no migration SQL files are orphaned without gap check coverage', () => {
    const sqlCount = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && !f.endsWith('.verify.sql')).length
    expect(sqlCount).toBeGreaterThan(50)
  })
})
