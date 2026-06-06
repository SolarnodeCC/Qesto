#!/usr/bin/env npx tsx
/**
 * HLT-007 — Fail when committed OpenAPI artifact drifts from source spec module.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OPENAPI_V3_SPEC } from '../functions/api/lib/openapi-v3-spec'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const artifactPath = join(root, 'contracts/generated/openapi-v3.json')
const write = process.argv.includes('--write')
const serialized = `${JSON.stringify(OPENAPI_V3_SPEC, null, 2)}\n`

if (write) {
  writeFileSync(artifactPath, serialized)
  console.log('Wrote contracts/generated/openapi-v3.json')
  process.exit(0)
}

let onDisk = ''
try {
  onDisk = readFileSync(artifactPath, 'utf8')
} catch {
  writeFileSync(artifactPath, serialized)
  console.log('Created contracts/generated/openapi-v3.json')
  process.exit(0)
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex')
if (hash(onDisk) !== hash(serialized)) {
  console.error('contracts/generated/openapi-v3.json is out of date — run: npm run check:contracts -- --write')
  process.exit(1)
}
console.log('check:contracts OK')
