#!/usr/bin/env node
/**
 * Verifies Sprint 51–60 deliverable files exist (CI-friendly DoD gate).
 */
import { access } from 'node:fs/promises'

const required = [
  'knowledge-base/governance/OBSIDIAN_KB_STANDARD.md',
  'knowledge-base/operations/MULTI_REGION_RUNBOOK.md',
  'knowledge-base/operations/MULTI_REGION_DRILL_CHECKLIST.md',
  'knowledge-base/operations/STAGING_RITUALS_S51_60.md',
  'knowledge-base/product/planning/SPRINT51_60_DOD_CHECKLIST.md',
  'functions/api/lib/multi-region-mutation.ts',
  'functions/api/lib/tournament-live.ts',
  'functions/api/routes/webhook-testing.ts',
  'functions/api/routes/partner-marketplace.ts',
  'src/pages/Soc2TrustPage.tsx',
  'src/components/SimilarSessionsPanel.tsx',
  'tests/unit/tournament-live.test.ts',
  'tests/unit/webhook-rate-limit.test.ts',
]

const missing = []
for (const f of required) {
  try {
    await access(f)
  } catch {
    missing.push(f)
  }
}

if (missing.length) {
  console.error('Sprint 51–60 DoD file check failed. Missing:')
  for (const m of missing) console.error('  -', m)
  process.exit(1)
}
console.log(`Sprint 51–60 DoD: ${required.length} required paths OK`)
