#!/usr/bin/env node
// scripts/check-tokens-drift.mjs
// DESIGN-TOK-01: Detects drift between design-tokens.json and the generated
// src/ui/tokens.ts / src/ui/tailwind-theme.ts artefacts.
//
// Invoked by CI. Re-runs build-tokens.mjs into a temp buffer and compares
// the output against the committed files. Fails if they differ, instructing
// the developer to run `npm run tokens:build`.

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildTokens } from './build-tokens.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const TOKENS_TS    = resolve(ROOT, 'src/ui/tokens.ts')
const TAILWIND_TS  = resolve(ROOT, 'src/ui/tailwind-theme.ts')

function fail(msg) {
  console.error(`\n❌ Design-token drift detected: ${msg}`)
  console.error('Run `npm run tokens:build` to regenerate the artefacts, then commit.\n')
  process.exit(1)
}

// 1. Verify generated artefacts exist at all
if (!existsSync(TOKENS_TS)) {
  fail('src/ui/tokens.ts is missing. Run `npm run tokens:build`.')
}
if (!existsSync(TAILWIND_TS)) {
  fail('src/ui/tailwind-theme.ts is missing. Run `npm run tokens:build`.')
}

// 2. Capture committed content
const committedTokens   = readFileSync(TOKENS_TS, 'utf8')
const committedTailwind = readFileSync(TAILWIND_TS, 'utf8')

// 3. Redirect build output to a temp directory, then compare outputs. This
//    keeps the working tree clean and avoids shell path issues on Windows.
const tempDir = mkdtempSync(resolve(tmpdir(), 'qesto-tokens-'))
const tempTokens = resolve(tempDir, 'tokens.ts')
const tempTailwind = resolve(tempDir, 'tailwind-theme.ts')

try {
  buildTokens({
    outTokens: tempTokens,
    outTailwind: tempTailwind,
    log: () => {},
  })
} catch (err) {
  rmSync(tempDir, { recursive: true, force: true })
  fail(`build-tokens.mjs failed: ${err.message}`)
}

// 4. Read the freshly generated files
const freshTokens = readFileSync(tempTokens, 'utf8')
const freshTailwind = readFileSync(tempTailwind, 'utf8')
rmSync(tempDir, { recursive: true, force: true })

// 5. Report every stale artefact in one actionable error.
const stale = []
if (freshTokens !== committedTokens) {
  stale.push('src/ui/tokens.ts')
}
if (freshTailwind !== committedTailwind) {
  stale.push('src/ui/tailwind-theme.ts')
}

if (stale.length > 0) {
  fail(`${stale.join(', ')} out of date with docs/spec/design-tokens.json`)
}

console.log('✅ Design-token artefacts are up to date — no drift detected.')
process.exit(0)
