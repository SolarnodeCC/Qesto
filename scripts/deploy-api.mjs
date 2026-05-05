#!/usr/bin/env node
import { execFileSync, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const rawArgs = process.argv.slice(2)
const allowDirty = rawArgs.includes('--allow-dirty')
const args = rawArgs.filter((arg) => arg !== '--allow-dirty')

function localCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 12)
  return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
}

function workingTreeStatus() {
  return execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
}

const status = workingTreeStatus()
if (status && !allowDirty) {
  console.error('Refusing to deploy from a dirty working tree.')
  console.error('Commit or stash changes first, or pass --allow-dirty for an intentional non-release dry-run.')
  process.exit(1)
}

const commit = localCommit()
const wranglerBin = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url))
const deployArgs = [
  'deploy',
  `--var=COMMIT_SHA:${commit}`,
  `--message=deploy-${commit}`,
  `--tag=${commit}`,
  ...args,
]

execFileSync(process.execPath, [wranglerBin, ...deployArgs], { stdio: 'inherit' })
