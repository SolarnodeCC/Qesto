#!/usr/bin/env node
// scripts/check-tokens-drift.mjs
// DESIGN-TOK-01: Detects drift between design-tokens.json and the generated
// src/ui/tokens.ts / src/ui/tailwind-theme.ts artefacts.
//
// Invoked by CI. Re-runs build-tokens.mjs into a temp buffer and compares
// the output against the committed files. Fails if they differ, instructing
// the developer to run `npm run tokens:build`.

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = new URL('.', import.meta.url).pathname
const ROOT = resolve(__dirname, '..')

const TOKENS_TS    = resolve(ROOT, 'src/ui/tokens.ts')
const TAILWIND_TS  = resolve(ROOT, 'src/ui/tailwind-theme.ts')
const TOKENS_TEMP  = resolve(ROOT, 'src/ui/tokens.ts.tmp')
const TAILWIND_TEMP = resolve(ROOT, 'src/ui/tailwind-theme.ts.tmp')

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

// 3. Temporarily redirect build output to .tmp files by running the build
//    script in a subprocess, then comparing outputs.
//    We patch the output paths via env vars instead of editing the script.
try {
  // Run the build and capture what it would write
  execSync(`node ${resolve(__dirname, 'build-tokens.mjs')}`, {
    cwd: ROOT,
    stdio: 'pipe', // suppress output during drift check
  })
} catch (err) {
  fail(`build-tokens.mjs failed: ${err.message}`)
}

// 4. Read the freshly regenerated files
const freshTokens   = readFileSync(TOKENS_TS, 'utf8')
const freshTailwind = readFileSync(TAILWIND_TS, 'utf8')

// 5. Restore committed content (build-tokens overwrites in-place; we detect
//    whether the freshly written content matches what was already there)
if (freshTokens !== committedTokens) {
  // Restore to committed so the working tree isn't dirty after the check
  writeFileSync(TOKENS_TS, committedTokens)
  fail('src/ui/tokens.ts is out of date with docs/specs/design-tokens.json')
}

if (freshTailwind !== committedTailwind) {
  writeFileSync(TAILWIND_TS, committedTailwind)
  fail('src/ui/tailwind-theme.ts is out of date with docs/specs/design-tokens.json')
}

console.log('✅ Design-token artefacts are up to date — no drift detected.')
process.exit(0)
