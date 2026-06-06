#!/usr/bin/env node
/**
 * verify-migration-metadata.mjs
 * CI guard mirroring jankurai HLT-021/HLT-030 migration safety checks.
 * Requires adjacent {stem}.meta.toml for destructive migrations and
 * lock_timeout + statement_timeout for ALTER TABLE migrations.
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, '..', 'migrations')

const DESTRUCTIVE_PATTERNS = [
  /drop\s+table/i,
  /truncate/i,
  /drop\s+column/i,
  /drop\s+constraint/i,
  /drop\s+schema/i,
  /drop\s+database/i,
  /disable\s+trigger/i,
]

const ALTER_TABLE_PATTERN = /alter\s+table/i

function sqlFiles() {
  return readdirSync(migrationsDir).filter((f) => f.endsWith('.sql') && !f.endsWith('.verify.sql'))
}

function readMeta(stem) {
  const path = join(migrationsDir, `${stem}.meta.toml`)
  if (!existsSync(path)) return null
  return readFileSync(path, 'utf8').toLowerCase()
}

function executableSql(name) {
  const raw = readFileSync(join(migrationsDir, name), 'utf8')
  return raw
    .split('\n')
    .map((line) => line.replace(/--.*$/, '').trim())
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
}

function hasDestructiveSafety(meta) {
  return (
    meta.includes('owner') &&
    (meta.includes('approval') || meta.includes('approved') || meta.includes('approver')) &&
    (meta.includes('rollback') || meta.includes('roll_forward') || meta.includes('roll-forward')) &&
    (meta.includes('backup') || meta.includes('restore') || (meta.includes('irreversible') && meta.includes('approval'))) &&
    ((meta.includes('lock_timeout') && meta.includes('statement_timeout')) || (meta.includes('lock') && meta.includes('timeout'))) &&
    (meta.includes('verify') || meta.includes('verification') || meta.includes('check_artifact'))
  )
}

function hasTimeouts(meta) {
  return (
    (meta.includes('lock_timeout') && meta.includes('statement_timeout')) ||
    (meta.includes('lock') && meta.includes('timeout'))
  )
}

function hasVerifySidecar(stem) {
  return (
    existsSync(join(migrationsDir, `${stem}.verify.sql`)) ||
    existsSync(join(migrationsDir, `${stem}.check.sql`))
  )
}

let failed = false

for (const file of sqlFiles()) {
  const stem = file.replace(/\.sql$/, '')
  const sql = executableSql(file)
  const meta = readMeta(stem)

  const destructive = DESTRUCTIVE_PATTERNS.some((re) => re.test(sql))
  const alterTable = ALTER_TABLE_PATTERN.test(sql)

  if (destructive) {
    if (!meta) {
      console.error(`❌ ${file}: destructive migration missing ${stem}.meta.toml`)
      failed = true
      continue
    }
    if (!hasDestructiveSafety(meta) && !(hasVerifySidecar(stem) && hasTimeouts(meta))) {
      console.error(`❌ ${file}: ${stem}.meta.toml lacks required safety fields (owner, approval, rollback, backup, timeouts, verify)`)
      failed = true
    }
  }

  if (alterTable) {
    if (!meta) {
      console.error(`❌ ${file}: ALTER TABLE migration missing ${stem}.meta.toml with lock_timeout/statement_timeout`)
      failed = true
      continue
    }
    if (!hasTimeouts(meta) && !sql.includes('lock_timeout') && !sql.includes('statement_timeout')) {
      console.error(`❌ ${file}: ${stem}.meta.toml missing lock_timeout and statement_timeout`)
      failed = true
    }
  }

  if (sql.includes('pragma foreign_keys') && sql.includes('= off')) {
    const hasRecheck =
      sql.includes('pragma foreign_keys = on') &&
      sql.includes('foreign_key_check') &&
      (sql.includes('quick_check') || sql.includes('integrity_check'))
    const verifyOk = hasVerifySidecar(stem) || (meta && meta.includes('verify'))
    if (!hasRecheck && !verifyOk) {
      console.error(`❌ ${file}: PRAGMA foreign_keys=OFF without post-check evidence`)
      failed = true
    }
  }
}

if (failed) {
  console.error('\nFix: add migrations/{stem}.meta.toml per migrations/.metadata/README.md')
  process.exit(1)
}

console.log(`✅ Migration safety metadata verified (${sqlFiles().length} SQL files)`)
