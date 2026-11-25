#!/usr/bin/env node
/**
 * BE-FLAG-CONTRACT-01 — wrangler [vars] boolean flags must use "true"/"false".
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const toml = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8')

const BOOL_FLAGS = [
  'INTEGRATION_ENABLED',
  'CIRCUIT_BREAKER_ENABLED',
  'ATOMIC_RATE_LIMIT_ENABLED',
  'SAML_SSO_ENABLED',
  'SAML_SIGNATURE_VERIFY_ENABLED',
  'BETA_XR_ENABLED',
  'LIVE_ENERGIZERS_ENABLED',
  'SENTIMENT_ENABLED',
]

let failed = false
for (const flag of BOOL_FLAGS) {
  const re = new RegExp(`^${flag}\\s*=\\s*"([^"]*)"`, 'm')
  const m = toml.match(re)
  if (!m) continue
  const value = m[1]
  if (value !== 'true' && value !== 'false') {
    console.error(`✗ ${flag} = "${value}" — must be "true" or "false" (getFlag contract)`)
    failed = true
  }
}

if (failed) process.exit(1)
console.log('✓ wrangler boolean flag contract OK')
