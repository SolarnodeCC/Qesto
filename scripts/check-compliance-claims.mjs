#!/usr/bin/env node
/**
 * COMPLIANCE-02 (minimum viable): ensure marketing surfaces with compliance
 * claims reference on-disk evidence files in knowledge-base/security/.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const CLAIM_CHECKS = [
  {
    id: 'soc2',
    pattern: /\bSOC\s*2\b/i,
    evidence: 'knowledge-base/security/SOC2_EVIDENCE.md',
    scanDirs: ['src/pages'],
  },
  {
    id: 'eu-hosted',
    pattern: /\bEU[- ]hosted\b/i,
    evidence: 'knowledge-base/security/EU_DATA_RESIDENCY.md',
    scanDirs: ['src/pages'],
  },
  {
    id: 'eu-residency',
    pattern: /\bEU\s+data\s+residen/i,
    evidence: 'knowledge-base/security/EU_DATA_RESIDENCY.md',
    scanDirs: ['src/pages'],
  },
  {
    id: 'gdpr-badge',
    pattern: /\bGDPR\s+(compliant|certified|badge)\b/i,
    evidence: 'knowledge-base/security/SOC2_EVIDENCE.md',
    scanDirs: ['src/pages'],
  },
]

function listFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) listFiles(full, acc)
    else if (/\.(tsx?|html|md)$/.test(ent.name)) acc.push(full)
  }
  return acc
}

let failed = false

for (const check of CLAIM_CHECKS) {
  const evidencePath = path.join(root, check.evidence)
  if (!fs.existsSync(evidencePath)) {
    console.error(`ERROR [${check.id}]: missing evidence file ${check.evidence}`)
    failed = true
    continue
  }

  for (const relDir of check.scanDirs) {
    const absDir = path.join(root, relDir)
    for (const file of listFiles(absDir)) {
      const text = fs.readFileSync(file, 'utf8')
      if (!check.pattern.test(text)) continue
      const rel = path.relative(root, file)
      if (!text.includes(check.evidence) && !text.includes('roadmap')) {
        console.error(
          `ERROR [${check.id}]: ${rel} contains a compliance claim but does not reference ${check.evidence} or mark as roadmap`,
        )
        failed = true
      }
    }
  }
}

if (failed) {
  process.exit(1)
}
console.log('OK: compliance claim / evidence cross-check passed')
