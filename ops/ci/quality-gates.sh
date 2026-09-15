#!/bin/bash
# ops/ci/quality-gates.sh — Pre-push verification gates
# Ensures code quality before push. Called by:
#   - ops/git-hooks/pre-push (local)
#   - GitHub Actions (CI)

set -e

source "$(dirname "$0")/lib.sh"

report_lane_start "quality-gates"

assert_tool node
assert_tool npm
assert_node_version

# Verify package-lock.json is present
assert_file "package-lock.json" "npm lockfile"

# Install dependencies
report_success "Installing dependencies"
npm ci --silent

# Claude Code config conventions (.claude/ prompt-asset layer): enforces
# per-agent version/owner/model frontmatter, COMMON_RULES reference, OWNERS.md
# sync, no dead skill links, and presence of the prompt-defense baseline.
report_success "Claude config conventions (check:claude-config)"
node scripts/check-claude-config.mjs

# Architecture ratchets (REFACTORING_AUDIT.md / ADR-0068..0070): each gate counts
# a known anti-pattern and fails if it grows — debt can only shrink, never creep.
#   - check-ai-gateway: raw env.AI.run outside lib/ai/ai-gateway.ts (runAI facade)
#   - check-d1-access:  inline env.DB.prepare in routes (belongs in repositories/)
#   - check-error-response: inline `ok: false` envelopes (belongs in errorResponse())
#   - check-kv-access:  direct env.*_KV calls outside lib/kv.ts (baseline 0 —
#     its absence here let 15 violations creep in; see REFACTORING_AUDIT_2026-07-08.md)
report_success "Architecture ratchets (AI gateway / D1 repo / error builder / KV / cycles)"
node scripts/check-ai-gateway.mjs
node scripts/check-d1-access.mjs
node scripts/check-error-response.mjs
node scripts/check-kv-access.mjs
# DD-13: runtime import cycles (type-only imports are erased and excluded).
# Baseline 0 — the only cycles madge reported were type-only, and lib/authz.ts's
# inversion into the route layer is resolved via interface segregation.
node scripts/check-circular-deps.mjs

# Type checking (fast, no emit)
report_success "Type checking (tsc --noEmit)"
npx tsc --noEmit

# Lint ratchet. Until RT-2026-09 this block was dead twice over: it was guarded
# on an .eslintrc.json that never existed, and `|| true` meant it could not fail
# even if it had run. ESLint now runs for real against a per-rule baseline
# (scripts/check-lint-baseline.mjs) — errors may only shrink.
report_success "Lint ratchet (check:lint)"
node scripts/check-lint-baseline.mjs

# Requirement traceability ratchet: every test file names the requirement it
# proves (ADR / SPEC section / backlog id / issue) in a header docblock, so a
# failing test can be triaged against a source of truth and a requirement cannot
# quietly lose its last test. Baseline 0 — see QA_FULL.md §5.
report_success "Test requirement traceability (check:test-traceability)"
node scripts/check-test-traceability.mjs

# AI eval golden set (REV-10 DoD gate): prompt-injection confinement, output
# schema acceptance/rejection corpus, PII scrub, governance guard matrix.
report_success "AI eval golden set"
npm run test:eval

# Unit tests with coverage (enforces the regression floor in vite.config.ts
# and produces coverage/ for the CI artifact-upload step)
report_success "Running unit tests with coverage"
npm run test:coverage

report_success "Quality gates passed"
exit 0
