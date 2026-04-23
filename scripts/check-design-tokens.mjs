#!/usr/bin/env node
/**
 * Check design token drift — ensure generated tokens.ts and tailwind-theme.ts
 * are in sync with design-tokens.json source.
 *
 * Usage: node scripts/check-design-tokens.mjs
 * Exit code: 0 if tokens are in sync, 1 if regeneration needed
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_TOKENS = resolve(ROOT, 'src/ui/tokens.ts')
const OUT_TAILWIND = resolve(ROOT, 'src/ui/tailwind-theme.ts')

// Save current state
const currentTokens = readFileSync(OUT_TOKENS, 'utf8')
const currentTailwind = readFileSync(OUT_TAILWIND, 'utf8')

// Regenerate
const result = spawnSync('node', [resolve(__dirname, 'build-tokens.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
})

if (result.error) {
  console.error('[check-design-tokens] ✗ Token generation failed:', result.error.message)
  process.exit(1)
}

// Compare
const newTokens = readFileSync(OUT_TOKENS, 'utf8')
const newTailwind = readFileSync(OUT_TAILWIND, 'utf8')

const tokensMatch = currentTokens === newTokens
const tailwindMatch = currentTailwind === newTailwind

if (!tokensMatch) {
  console.error('[check-design-tokens] ✗ Design tokens out of sync!')
  console.error('  tokens.ts was regenerated. Run: npm run tokens:build')
}

if (!tailwindMatch) {
  console.error('[check-design-tokens] ✗ Tailwind theme out of sync!')
  console.error('  tailwind-theme.ts was regenerated. Run: npm run tokens:build')
}

if (!tokensMatch || !tailwindMatch) {
  // Restore original state so user must run tokens:build explicitly
  writeFileSync(OUT_TOKENS, currentTokens)
  writeFileSync(OUT_TAILWIND, currentTailwind)
  console.error('[check-design-tokens] FAILED — design tokens out of sync')
  process.exit(1)
}

console.log('[check-design-tokens] ✓ Design tokens in sync')
process.exit(0)
