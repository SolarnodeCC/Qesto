#!/usr/bin/env node
/**
 * check-testgaps.mjs
 *
 * Repo-wide test-gap "worker". Scans the working-tree changed source files and
 * flags those that lack a matching unit test. A consolidated complement to the
 * per-file reminders in .claude/hooks/post-edit.sh — the Stop hook runs this so
 * a session ends with one report instead of scattered nudges.
 *
 * Scope (mirrors post-edit.sh expectations):
 *   - functions/api/routes/<domain>.routes.ts  → tests/unit/<domain>.test.ts   (BLOCKING-grade gap)
 *   - src/(pages|components)/**\/<Name>.tsx     → tests/unit/<Name>.test.tsx     (advisory gap)
 *
 * Usage:
 *   node scripts/check-testgaps.mjs            # advisory: report + exit 0
 *   node scripts/check-testgaps.mjs --strict   # exit 1 if any route gap (for CI)
 *   node scripts/check-testgaps.mjs --all      # scan whole tree, not just changed files
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

const STRICT = process.argv.includes('--strict')
const SCAN_ALL = process.argv.includes('--all')

/** Source files changed in the working tree (staged + unstaged + untracked). */
function changedSourceFiles() {
  try {
    const out = execSync('git status --porcelain', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    })
    return out
      .split('\n')
      .map((line) => line.slice(3).trim()) // strip the 2-char status + space
      .filter(Boolean)
      // status can show "old -> new" for renames; take the new path
      .map((p) => (p.includes(' -> ') ? p.split(' -> ')[1] : p))
  } catch {
    return []
  }
}

/** Every tracked source file (used by --all). */
function allTrackedFiles() {
  try {
    return execSync('git ls-files functions/api/routes src', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
  } catch {
    return []
  }
}

const exists = (rel) => fs.existsSync(path.join(PROJECT_ROOT, rel))

/**
 * Map a source file to its expected test file, or null if not a tracked kind.
 * @returns {{file:string, test:string, severity:'route'|'component'}|null}
 */
function expectedTest(file) {
  if (/^functions\/api\/routes\/.+\.routes\.ts$/.test(file)) {
    const domain = path.basename(file, '.ts').replace(/\.routes$/, '')
    return { file, test: `tests/unit/${domain}.test.ts`, severity: 'route' }
  }

  if (/^src\/(?:pages|components)\/.+\.tsx$/.test(file)) {
    const name = path.basename(file, '.tsx')
    return { file, test: `tests/unit/${name}.test.tsx`, severity: 'component' }
  }

  return null
}

const candidates = SCAN_ALL ? allTrackedFiles() : changedSourceFiles()

const gaps = candidates
  .map(expectedTest)
  .filter(Boolean)
  .filter((g) => !exists(g.test))
  // de-dupe by source path
  .filter((g, i, arr) => arr.findIndex((x) => x.file === g.file) === i)

if (gaps.length === 0) {
  console.log(`✓ testgaps: no missing tests in ${SCAN_ALL ? 'the tree' : 'changed files'}.`)
  process.exit(0)
}

const routeGaps = gaps.filter((g) => g.severity === 'route')
const compGaps = gaps.filter((g) => g.severity === 'component')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(` Testgaps — ${gaps.length} source file(s) missing tests`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
if (routeGaps.length) {
  console.log(' Routes (required — see COMMON_RULES §8):')
  for (const g of routeGaps) console.log(`   ✗ ${g.file}\n       → create ${g.test}`)
}
if (compGaps.length) {
  console.log(' Components (advisory):')
  for (const g of compGaps) console.log(`   • ${g.file}\n       → consider ${g.test}`)
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

// In --strict mode, a missing route test is a failure (matches post-edit.sh BLOCKING).
process.exit(STRICT && routeGaps.length > 0 ? 1 : 0)
