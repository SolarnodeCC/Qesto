import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Governance regression tests for the jankurai audit lane.
// - Issue #612: the audit must be able to run BEFORE merge (pull_request trigger),
//   not only after a push to main.
// - Issue #613: the auditor that produces the merge witness must not fail open —
//   no mutable-tag install, no `|| true` swallowing the auditor itself, no
//   fabricated "green" fallback artifacts, and a version-match assertion.

const ROOT = process.cwd()
const WORKFLOW = readFileSync(join(ROOT, '.github/workflows/jankurai.yml'), 'utf8')
const LANE = readFileSync(join(ROOT, 'ops/ci/jankurai.sh'), 'utf8')
const STANDARD_VERSION = readFileSync(join(ROOT, 'agent/standard-version.toml'), 'utf8')

describe('jankurai.yml runs before merge (#612)', () => {
  it('has a pull_request trigger targeting main', () => {
    // Match the `on:` block, tolerant of the surrounding comments.
    expect(WORKFLOW).toMatch(/on:\s*[\s\S]*pull_request:\s*[\s\S]*branches:\s*\[\s*main\s*\]/)
  })

  it('still runs on push to main', () => {
    expect(WORKFLOW).toMatch(/push:\s*[\s\S]*branches:\s*\[\s*main\s*\]/)
  })
})

describe('jankurai audit lane does not fail open (#613)', () => {
  it('does not install the auditor from a mutable git tag', () => {
    // The old fail-open installed from `...jankurai.git#v1.6.10` (a movable tag).
    // The auditor is now built from the SHA-locked workspace via cargo --locked.
    expect(LANE).not.toMatch(/git\+https:\/\/github\.com\/neverhuman\/jankurai\.git#/)
    expect(LANE).not.toMatch(/git clone[^\n]*neverhuman\/jankurai/)
    expect(LANE).toContain('cargo install --path node_modules/jankurai-workspace/crates/jankurai --locked')
  })

  it('does not swallow the primary audit with `|| true`', () => {
    // Every `jankurai audit .` invocation must NOT be suffixed with `|| true`.
    const auditLines = LANE.split('\n')
    const offenders = auditLines.filter(
      (l) => /jankurai audit \./.test(l) && /\|\|\s*true/.test(l),
    )
    expect(offenders).toEqual([])
    // Belt and braces: no `install_jankurai ... || true` fail-open either.
    expect(LANE).not.toMatch(/install_jankurai[^\n]*\|\|\s*true/)
  })

  it('fails the lane instead of writing fabricated fallback artifacts', () => {
    expect(LANE).not.toContain('"status":"unavailable"')
    // The install path must exit non-zero when the auditor is unavailable.
    expect(LANE).toMatch(/install_jankurai[\s\S]*exit 1/)
  })

  it('asserts the auditor is present and version-matched before trusting it', () => {
    expect(LANE).toContain('EXPECTED_JANKURAI_VERSION')
    expect(LANE).toMatch(/version mismatch/i)
  })
})

describe('auditor supply-chain pin is recorded (#613)', () => {
  it('records the current auditor version and a full commit SHA', () => {
    expect(STANDARD_VERSION).toMatch(/auditor_version\s*=\s*"1\.6\.10"/)
    // A 40-hex-char commit SHA, not a mutable tag.
    expect(STANDARD_VERSION).toMatch(/auditor_commit\s*=\s*"[0-9a-f]{40}"/)
  })

  it('keeps the recorded SHA in sync with package-lock.json', () => {
    const lock = readFileSync(join(ROOT, 'package-lock.json'), 'utf8')
    const recorded = STANDARD_VERSION.match(/auditor_commit\s*=\s*"([0-9a-f]{40})"/)?.[1]
    expect(recorded).toBeTruthy()
    expect(lock).toContain(`neverhuman/jankurai.git#${recorded}`)
  })
})
