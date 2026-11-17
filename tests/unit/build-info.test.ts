/**
 * Deploy commit resolution — DD-08 follow-up.
 *
 * Requirement: knowledge-base/quality/audits/DUE_DILIGENCE_2026-09-15.md (DD-08)
 *
 * The post-deploy gate in .github/workflows/ci.yml compares GET /api/version's
 * `data.commit` with the pushed SHA. qesto.cc/api runs on the Pages Functions
 * bundle, whose dashboard env sets COMMIT_SHA="dev", so production reported
 * "dev" on every release and commit parity could never pass. These tests pin
 * the resolution order and the CI stamp script that bakes the SHA in.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createApp } from '../../functions/api/app'
import { BUILD_COMMIT, resolveCommit } from '../../functions/api/lib/build-info'

const SHA = '0123456789abcdef0123456789abcdef01234567'

describe('resolveCommit', () => {
  it('prefers a real COMMIT_SHA (the Worker deploy passes --var COMMIT_SHA)', () => {
    expect(resolveCommit({ COMMIT_SHA: 'abc123def456', CF_PAGES_COMMIT_SHA: SHA }, 'feedface')).toBe('abc123def456')
  })

  it('skips the dashboard placeholder "dev" in favour of the stamped build commit', () => {
    expect(resolveCommit({ COMMIT_SHA: 'dev' }, SHA)).toBe(SHA)
  })

  it('falls back to CF_PAGES_COMMIT_SHA on unstamped Git-integration builds', () => {
    expect(resolveCommit({ COMMIT_SHA: 'dev', CF_PAGES_COMMIT_SHA: SHA }, 'dev')).toBe(SHA)
  })

  it('treats empty, whitespace and "unknown" as placeholders', () => {
    expect(resolveCommit({ COMMIT_SHA: '  ', CF_PAGES_COMMIT_SHA: 'unknown' }, '')).toBe('unknown')
  })

  it('ships with the placeholder committed; only CI stamps a SHA', () => {
    expect(BUILD_COMMIT).toBe('dev')
  })

  it('GET /api/version reports the build commit instead of the "dev" env var', async () => {
    const app = createApp()
    // BUILD_COMMIT is 'dev' in the repo, so with COMMIT_SHA='dev' the Pages value wins.
    const res = await app.request('/api/version', {}, { ENV: 'production', COMMIT_SHA: 'dev', CF_PAGES_COMMIT_SHA: SHA })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { commit: string } }
    expect(body.data.commit).toBe(SHA)
  })
})

describe('scripts/stamp-build-commit.mjs', () => {
  const script = resolve(__dirname, '../../scripts/stamp-build-commit.mjs')
  const source = resolve(__dirname, '../../functions/api/lib/build-info.ts')

  // The script resolves its target relative to itself, so run a copy in a
  // scratch tree that mirrors the repo layout and never touch the real file.
  function scratch(): { dir: string; target: string; run: (sha: string) => void } {
    const dir = mkdtempSync(join(tmpdir(), 'stamp-'))
    mkdirSync(join(dir, 'scripts'))
    mkdirSync(join(dir, 'functions/api/lib'), { recursive: true })
    copyFileSync(script, join(dir, 'scripts/stamp-build-commit.mjs'))
    const target = join(dir, 'functions/api/lib/build-info.ts')
    copyFileSync(source, target)
    const run = (sha: string) =>
      execFileSync(process.execPath, [join(dir, 'scripts/stamp-build-commit.mjs'), sha], { stdio: 'pipe' })
    return { dir, target, run }
  }

  it('rewrites only the BUILD_COMMIT literal', () => {
    const { target, run } = scratch()
    const before = readFileSync(target, 'utf8')
    run(SHA)
    const after = readFileSync(target, 'utf8')
    expect(after).toContain(`export const BUILD_COMMIT: string = '${SHA}'`)
    expect(after.replace(SHA, 'dev')).toBe(before)
  })

  it('refuses a value that is not a git SHA', () => {
    const { target, run } = scratch()
    expect(() => run("abc'; drop")).toThrow()
    expect(readFileSync(target, 'utf8')).toContain("export const BUILD_COMMIT: string = 'dev'")
  })

  it('refuses when the declaration is missing, rather than deploying "dev" silently', () => {
    const { target, run } = scratch()
    writeFileSync(target, 'export const SOMETHING_ELSE = 1\n')
    expect(() => run(SHA)).toThrow()
  })
})
