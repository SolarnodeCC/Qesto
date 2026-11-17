#!/usr/bin/env node
/**
 * Stamp the git commit into functions/api/lib/build-info.ts (BUILD_COMMIT) so a
 * direct-upload Pages deploy (`wrangler pages deploy`) reports the commit it was
 * built from. See build-info.ts for why the runtime env cannot be relied on.
 *
 * Usage: node scripts/stamp-build-commit.mjs [sha]
 *   sha defaults to $GITHUB_SHA, then `git rev-parse HEAD`.
 *
 * CI-only: it rewrites a tracked file. Run it after anything that refuses a dirty
 * working tree (scripts/deploy-api.mjs) and right before the Pages deploy.
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const target = fileURLToPath(new URL('../functions/api/lib/build-info.ts', import.meta.url))

function headSha() {
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

const sha = (process.argv[2] ?? process.env.GITHUB_SHA ?? headSha()).trim().toLowerCase()
if (!/^[0-9a-f]{7,40}$/.test(sha)) {
  console.error(`stamp-build-commit: refusing to stamp ${JSON.stringify(sha)}: not a git SHA`)
  process.exit(1)
}

const pattern = /^export const BUILD_COMMIT: string = '[^'\n]*'$/gm
const source = readFileSync(target, 'utf8')
const matches = source.match(pattern) ?? []
if (matches.length !== 1) {
  console.error(`stamp-build-commit: expected exactly one BUILD_COMMIT declaration in ${target}, found ${matches.length}`)
  process.exit(1)
}

writeFileSync(target, source.replace(pattern, `export const BUILD_COMMIT: string = '${sha}'`))
console.log(`stamp-build-commit: BUILD_COMMIT = ${sha}`)
