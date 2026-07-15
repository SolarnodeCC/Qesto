import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const SCRIPT = join(ROOT, 'scripts', 'reconcile-remote-d1.mjs')
const MIGRATIONS = join(ROOT, 'migrations')

type FakeRun = {
  calls: string[][]
  output: string
  stampSql: string | null
}

function runWithFakeNpx(args: string[] = []): FakeRun {
  const dir = mkdtempSync(join(tmpdir(), 'qesto-reconcile-d1-'))
  const log = join(dir, 'npx-calls.jsonl')
  const stampCopy = join(dir, 'stamp.sql')

  try {
    writeFileSync(
      join(dir, 'npx'),
      [
        '#!/usr/bin/env node',
        "import { appendFileSync, copyFileSync } from 'node:fs'",
        'const args = process.argv.slice(2)',
        "appendFileSync(process.env.QESTO_FAKE_NPX_LOG, JSON.stringify(args) + '\\n')",
        'for (const arg of args) {',
        "  if (!arg.startsWith('--file=')) continue",
        "  const file = arg.slice('--file='.length)",
        "  if (file.includes('qesto-d1-stamp-') && process.env.QESTO_FAKE_NPX_STAMP_COPY) {",
        '    copyFileSync(file, process.env.QESTO_FAKE_NPX_STAMP_COPY)',
        '  }',
        '}',
        '',
      ].join('\n'),
    )
    chmodSync(join(dir, 'npx'), 0o755)

    const output = execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${dir}${delimiter}${process.env.PATH ?? ''}`,
        QESTO_FAKE_NPX_LOG: log,
        QESTO_FAKE_NPX_STAMP_COPY: stampCopy,
      },
    })

    const calls = readFileSync(log, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as string[])

    return {
      calls,
      output,
      stampSql: existsSync(stampCopy) ? readFileSync(stampCopy, 'utf8') : null,
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('scripts/reconcile-remote-d1.mjs', () => {
  it('is dry-run by default and does not execute remote write commands', () => {
    const run = runWithFakeNpx()

    expect(run.output).toContain('DRY-RUN')
    expect(run.stampSql).toBeNull()
    expect(run.calls).toEqual([['wrangler', 'd1', 'migrations', 'list', 'qesto_3_db', '--remote']])
  })

  it('applies only the safe gallery migration and stamps real migrations idempotently', () => {
    const run = runWithFakeNpx(['--apply'])

    expect(run.calls).toHaveLength(5)
    expect(run.calls[0]).toEqual(['wrangler', 'd1', 'migrations', 'list', 'qesto_3_db', '--remote'])
    expect(run.calls[1]).toEqual([
      'wrangler',
      'd1',
      'execute',
      'qesto_3_db',
      '--remote',
      '--file=migrations/0079_marketing_templates_registry.sql',
    ])
    expect(run.calls[2].slice(0, 5)).toEqual(['wrangler', 'd1', 'execute', 'qesto_3_db', '--remote'])
    expect(run.calls[2].find((arg) => arg.startsWith('--file='))).toMatch(/qesto-d1-stamp-\d+\.sql$/)
    expect(run.calls[3]).toEqual(['wrangler', 'd1', 'migrations', 'list', 'qesto_3_db', '--remote'])
    expect(run.calls[4]).toEqual([
      'wrangler',
      'd1',
      'execute',
      'qesto_3_db',
      '--remote',
      '--command=SELECT count(*) AS marketing_templates_rows FROM marketing_templates;',
    ])

    const migrationNames = readdirSync(MIGRATIONS)
      .filter((name) => name.endsWith('.sql') && !name.endsWith('.verify.sql'))
      .sort()
    const verifySidecars = readdirSync(MIGRATIONS).filter((name) => name.endsWith('.verify.sql'))
    const insertStatements =
      run.stampSql?.match(/INSERT OR IGNORE INTO d1_migrations \(name, applied_at\)/g) ?? []

    expect(run.stampSql).toContain('CREATE TABLE IF NOT EXISTS d1_migrations(')
    expect(insertStatements).toHaveLength(migrationNames.length)
    for (const name of migrationNames) {
      expect(run.stampSql).toContain(`VALUES ('${name}', datetime('now'));`)
    }
    expect(verifySidecars.length).toBeGreaterThan(0)
    for (const sidecar of verifySidecars) {
      expect(run.stampSql).not.toContain(sidecar)
    }
  })
})
