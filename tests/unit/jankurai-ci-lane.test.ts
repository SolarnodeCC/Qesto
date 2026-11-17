import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Governance regression tests for the jankurai audit lane.
// - Issue #612: the audit must be able to run BEFORE merge (pull_request trigger),
//   not only after a push to main.
// - Issue #613: the auditor that produces the merge witness must not fail open —
//   no mutable-tag install, no `|| true` swallowing the auditor itself, no
//   fabricated "green" fallback artifacts, and a version-match assertion.
// - v1.7.6 bump (supersedes Dependabot #981): the hub is no longer a Cargo
//   workspace, so the CLI is installed via the locked hub's verifying installer.

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
    // Since v1.7.x the auditor is installed by the hub's own installer, run from
    // the SHA-locked copy `npm ci` vendors; it verifies the signed release.
    expect(LANE).not.toMatch(/git\+https:\/\/github\.com\/neverhuman\/jankurai\.git#/)
    expect(LANE).not.toMatch(/git clone[^\n]*neverhuman\/jankurai/)
    expect(LANE).not.toMatch(/cargo install --git/)
    expect(LANE).toContain('JANKURAI_HUB="node_modules/jankurai-workspace"')
    expect(LANE).toContain('bash "$JANKURAI_HUB/jankurai-installer.sh"')
    expect(WORKFLOW).toContain('bash node_modules/jankurai-workspace/jankurai-installer.sh')
  })

  it('installs exactly the pinned release tag, matching the vendored hub', () => {
    // The release tag is derived from auditor_version, never a hard-coded or default tag.
    expect(LANE).toContain('JANKURAI_RELEASE_TAG="v$EXPECTED_JANKURAI_VERSION"')
    expect(WORKFLOW).toContain('JANKURAI_RELEASE_TAG="v$version"')
    // Both refuse to run when the vendored hub VERSION disagrees with the pin.
    expect(LANE).toContain('$JANKURAI_HUB/VERSION')
    expect(WORKFLOW).toContain('node_modules/jankurai-workspace/VERSION')
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
    // auditor_version must name the hub release package-lock.json vendors.
    const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'))
    const hubVersion = lock.packages?.['node_modules/jankurai-workspace']?.version
    expect(hubVersion).toMatch(/^\d+\.\d+\.\d+$/)
    expect(STANDARD_VERSION).toMatch(new RegExp(`auditor_version\\s*=\\s*"${hubVersion.replace(/\./g, '\\.')}"`))
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
