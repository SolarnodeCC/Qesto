/**
 * Requirement: CI Playwright lane — webServer must start from the repo root
 * (regression for the exit-127 lane failure fixed in (#859); SPEC_DEPLOYMENT CI lanes).
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Playwright's webServer.command default cwd is the config file directory
// (`tests/`), not the repo root. `bash scripts/e2e-webserver.sh` then looks
// for tests/scripts/e2e-webserver.sh and the CI job dies with exit 127.

const ROOT = process.cwd()
const CONFIG_DIR = join(ROOT, 'tests')
const CONFIG_SRC = readFileSync(join(CONFIG_DIR, 'playwright.config.ts'), 'utf8')

describe('playwright webServer cwd', () => {
  it('pins webServer.cwd at the repo root', () => {
    expect(CONFIG_SRC).toMatch(/webServer:\s*\{[\s\S]*?cwd:\s*repoRoot/)
  })

  it('finds scripts/e2e-webserver.sh from the repo root, not from tests/', () => {
    const cwd = resolve(CONFIG_DIR, '..')
    expect(existsSync(join(cwd, 'scripts/e2e-webserver.sh'))).toBe(true)
    expect(existsSync(join(CONFIG_DIR, 'scripts/e2e-webserver.sh'))).toBe(false)
  })
})
