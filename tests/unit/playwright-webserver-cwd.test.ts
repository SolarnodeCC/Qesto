import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Regression for the main Playwright lane: Playwright's webServer.command
// default cwd is the config file directory (`tests/`), not the repo root.
// `bash scripts/e2e-webserver.sh` then looks for tests/scripts/e2e-webserver.sh
// and the CI job dies with exit 127 before any spec runs.

const ROOT = process.cwd()
const CONFIG_DIR = join(ROOT, 'tests')
const CONFIG_SRC = readFileSync(join(CONFIG_DIR, 'playwright.config.ts'), 'utf8')

describe('playwright webServer cwd', () => {
  it('pins cwd at the parent of testsDir (the repo root)', () => {
    expect(CONFIG_SRC).toMatch(/webServer:\s*\{[\s\S]*?cwd:\s*path\.join\(testsDir,\s*['"]\.\.['"]\)/)
  })

  it('finds scripts/e2e-webserver.sh from that cwd, not from tests/', () => {
    const cwd = resolve(CONFIG_DIR, '..')
    expect(existsSync(join(cwd, 'scripts/e2e-webserver.sh'))).toBe(true)
    expect(existsSync(join(CONFIG_DIR, 'scripts/e2e-webserver.sh'))).toBe(false)
  })
})
