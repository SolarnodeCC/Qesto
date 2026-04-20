#!/usr/bin/env node
// scripts/build-tokens.mjs
// Generates src/ui/tokens.ts from docs/specs/design-tokens.json.
// Invoked by `npm run tokens:build` (runs automatically in `npm run build`).
// Never hand-edit src/ui/tokens.ts — it is a derived artefact (DESIGN-TOK-01).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SRC = resolve(ROOT, 'docs/specs/design-tokens.json')
const OUT = resolve(ROOT, 'src/ui/tokens.ts')

const raw = JSON.parse(readFileSync(SRC, 'utf8'))

function resolveRef(value, root) {
  if (typeof value !== 'string') return value
  const match = value.match(/^\{([^}]+)\}$/)
  if (!match) return value
  const parts = match[1].split('.')
  let node = root
  for (const p of parts) {
    node = node?.[p]
    if (!node) return value
  }
  return resolveRef(node.value ?? node, root)
}

function walk(node, root, path = []) {
  const out = {}
  for (const [key, val] of Object.entries(node)) {
    if (key.startsWith('$')) continue
    if (val && typeof val === 'object' && 'value' in val) {
      out[key] = resolveRef(val.value, root)
    } else if (val && typeof val === 'object') {
      out[key] = walk(val, root, [...path, key])
    }
  }
  return out
}

const tokens = walk(raw, raw)

const banner = `// AUTO-GENERATED from docs/specs/design-tokens.json — do not edit by hand.
// Regenerate: \`npm run tokens:build\`. See DESIGN-TOK-01.

`

const body = `export const tokens = ${JSON.stringify(tokens, null, 2)} as const\n\nexport type Tokens = typeof tokens\n`

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, banner + body)
console.log(`✓ wrote ${OUT}`)
