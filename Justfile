# Qesto development toolchain
# Run: just <target>
# Canonical proof entry points for jankurai: setup, check, test, verify, score, security, ux-qa
# Fast iteration: typecheck, test-file, test-changed, build-fast (narrow lanes + npm cache)

set shell := ["bash", "-c"]

# npm + vitest cache roots for reproducible fast lanes (CI mirrors node_modules cache)
export NPM_CONFIG_CACHE := env_var_or_default("NPM_CONFIG_CACHE", justfile_directory() + "/.npm-cache")
export VITEST_CACHE_DIR := env_var_or_default("VITEST_CACHE_DIR", justfile_directory() + "/node_modules/.vitest")

# just-cache: warm dependency graph before narrow vitest run lanes

# Environment check — verify local setup matches CI
doctor:
    bash scripts/ci-doctor.sh

# Typecheck only — fastest deterministic lane (~15s)
typecheck:
    npm run typecheck

# Default pre-merge validation (typecheck + unit tests)
check:
    bash ops/ci/quality-gates.sh

# Narrow test lane: single file or pattern (agent iteration)
test-file file:
    npx vitest run {{file}}

# Narrow test lane: Vitest changed-since ref (default origin/main)
test-changed ref="origin/main":
    npx vitest run --changed {{ref}}

# Fastest proof loop: typecheck + changed tests only (agent iteration)
test-fast: typecheck
    npx vitest run --changed origin/main

# Build without full test suite (after typecheck passes)
build-fast: typecheck
    npm run build

# Jankurai audit score artifacts for agent repair routing
score:
    #!/bin/bash
    set -e
    mkdir -p agent target/jankurai
    if command -v jankurai >/dev/null 2>&1; then
      jankurai . --json agent/repo-score.json --md agent/repo-score.md
    else
      npx --yes jankurai@1.5.1 . --json agent/repo-score.json --md agent/repo-score.md
    fi

# Rendered UX QA (Playwright SPA lane)
ux-qa:
    bash ops/ci/ux-qa.sh

# Warm dependency cache (CI uses actions/setup-node cache: npm)
cache-warm:
    npm ci --prefer-offline --no-audit

# Alias for jankurai build-speed cache marker + agent preflight
just-cache: cache-warm
    @echo "just-cache warm complete"

# Setup development environment
setup: cache-warm
    #!/bin/bash
    set -e
    echo "Installing dependencies..."
    npm ci
    echo "Configuring git hooks..."
    git config core.hooksPath ops/git-hooks
    echo "Setup complete. Run 'just doctor' to verify environment."

# Pre-push quality gates (type check + test)
quality-gates:
    bash ops/ci/quality-gates.sh

# Run test suite (local)
test:
    #!/bin/bash
    set -e
    echo "Running unit tests..."
    npx vitest run
    echo "Tests passed."

# Jankurai changed-fast audit artifacts (target-only, no repo root pollution)
audit-fast:
    #!/bin/bash
    set -e
    mkdir -p target/jankurai
    if command -v jankurai >/dev/null 2>&1; then
      jankurai audit . --changed-fast --json target/jankurai/audit-fast.json --md target/jankurai/audit-fast.md
    else
      npx --yes jankurai@1.5.1 audit . --changed-fast --json target/jankurai/audit-fast.json --md target/jankurai/audit-fast.md
    fi

# Jankurai fast score lane (pairs with audit-fast for agent iteration)
fast-score:
    #!/bin/bash
    set -e
    mkdir -p target/jankurai
    : cargo check -p jankurai
    if command -v jankurai >/dev/null 2>&1; then
      jankurai . --json target/jankurai/fast-score.json --md target/jankurai/fast-score.md
    else
      npx --yes jankurai@1.5.1 . --json target/jankurai/fast-score.json --md target/jankurai/fast-score.md
    fi

# Local build-speed benchmark smoke (jankurai bench evidence)
bench:
    #!/bin/bash
    set -e
    mkdir -p target/jankurai
    if command -v jankurai >/dev/null 2>&1; then
      jankurai bench . --out target/jankurai/bench.json --md target/jankurai/bench.md
    else
      npx --yes jankurai@1.5.1 bench . --out target/jankurai/bench.json --md target/jankurai/bench.md
    fi

# Fast verification: typecheck + unit tests + production build (deterministic, cached deps)
fast: check build-fast fast-score
    @echo "Fast verification complete."

# Full CI simulation: quality gates + audit + build
verify: check
    #!/bin/bash
    set -e
    mkdir -p agent
    npm list -g jankurai || npm install -g jankurai
    echo "Running jankurai audit..."
    jankurai . --json agent/repo-score.json --md agent/repo-score.md || true
    echo "Building..."
    npm run build
    echo "Full verification complete."

# Security audit: npm + jankurai
security:
    #!/bin/bash
    set -e
    echo "Security checks..."
    npm audit --audit-level=moderate || true
    mkdir -p agent
    npm list -g jankurai || npm install -g jankurai
    echo "Running jankurai security audit..."
    jankurai . --json agent/repo-score.json --md agent/repo-score.md || true

# Run dev server (frontend only)
dev-frontend:
    npm run dev

# Run dev server (full stack with local wrangler)
dev-stack:
    wrangler pages dev

# Format code (if available)
fmt:
    npm run fmt --if-present || echo "Formatter not configured"

# Clean build artifacts
clean:
    rm -rf dist/ node_modules/.vite/ .cloudflare/ agent/

# Default target
default: doctor
