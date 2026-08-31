#!/usr/bin/env node
/**
 * ISS-029 / Phase 0 — verify main branch protection (requires gh auth).
 *
 * Usage:
 *   node scripts/check-github-branch-protection.mjs [branch]
 *
 * Exits 0 when protection exists with at least one required status check or review.
 * Exits 1 when unprotected or gh unavailable (documents manual follow-up).
 */
import { execSync } from 'node:child_process'

const branch = process.argv[2] ?? 'main'

function ghJson(args) {
  const out = execSync(`gh ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return JSON.parse(out)
}

try {
  execSync('gh auth status', { stdio: 'ignore' })
} catch {
  console.warn('⚠ gh not authenticated — cannot verify branch protection remotely.')
  console.warn('  Manual check: GitHub → Settings → Branches → main → require PR + status checks.')
  process.exit(2)
}

let repo
try {
  repo = ghJson('repo view --json nameWithOwner -q .nameWithOwner')
} catch (err) {
  console.error('✗ failed to resolve repository:', err.message ?? err)
  process.exit(1)
}

console.log(`→ branch protection audit: ${repo}@${branch}`)

try {
  const protection = ghJson(`api repos/${repo}/branches/${branch}/protection`)
  const checks = protection.required_status_checks?.contexts ?? []
  const reviews = protection.required_pull_request_reviews?.required_approving_review_count ?? 0
  console.log(`  required status checks: ${checks.length ? checks.join(', ') : '(none)'}`)
  console.log(`  required approving reviews: ${reviews}`)
  if (checks.length === 0 && reviews === 0) {
    console.error('✗ branch has protection object but no required checks or reviews')
    process.exit(1)
  }
  console.log('✓ branch protection present')
} catch (err) {
  const msg = err.stderr?.toString?.() ?? err.message ?? String(err)
  if (msg.includes('404') || msg.includes('Branch not protected')) {
    console.error(`✗ branch "${branch}" is not protected (GITHUB_INFRA_AUDIT C1)`)
    process.exit(1)
  }
  console.error('✗ gh api error:', msg)
  process.exit(1)
}
