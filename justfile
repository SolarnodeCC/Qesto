# Qesto development toolchain
# Run: just <target>
# Canonical proof entry points for jankurai: setup, check, test, verify, score, security, ux-qa

set shell := ["bash", "-c"]

# Environment check — verify local setup matches CI
doctor:
    bash scripts/ci-doctor.sh

# Default pre-merge validation (typecheck + unit tests)
check:
    bash ops/ci/quality-gates.sh

# Jankurai audit score artifacts for agent repair routing
score:
    #!/bin/bash
    set -e
    mkdir -p agent target/jankurai
    command -v jankurai >/dev/null 2>&1 || bash scripts/install-jankurai.sh
    jankurai audit . --mode advisory --json agent/repo-score.json --md agent/repo-score.md

# Rendered UX QA (Playwright SPA lane)
ux-qa:
    bash ops/ci/ux-qa.sh

# Setup development environment
setup:
    #!/bin/bash
    set -e
    echo "Installing dependencies..."
    npm ci
    echo "Configuring git hooks..."
    git config core.hooksPath ops/git-hooks
    echo "Installing jankurai audit CLI (v1.6.10)..."
    bash scripts/install-jankurai.sh
    echo "Setup complete. Run 'just doctor' to verify environment."

# Install/refresh the jankurai audit CLI (v1.6.10, pinned via package-lock.json)
install-jankurai:
    bash scripts/install-jankurai.sh

# Pre-push quality gates (type check + test)
quality-gates:
    bash ops/ci/quality-gates.sh

# Run test suite (local)
test:
    #!/bin/bash
    set -e
    echo "Running unit tests..."
    npm test -- --run
    echo "Tests passed."

# Fast verification (type check + build; uses quality-gates including tests)
fast: check
    #!/bin/bash
    set -e
    echo "Building..."
    npm run build
    echo "Fast verification complete."

# Full CI simulation: quality gates + audit + build
verify: check
    #!/bin/bash
    set -e
    mkdir -p agent
    command -v jankurai >/dev/null 2>&1 || bash scripts/install-jankurai.sh
    echo "Running jankurai audit..."
    jankurai audit . --mode advisory --json agent/repo-score.json --md agent/repo-score.md || true
    echo "Building..."
    npm run build
    echo "Full verification complete."

# Security audit: npm + jankurai
security:
    #!/bin/bash
    set -e
    echo "Security checks..."
    npm audit --audit-level=moderate || true
    mkdir -p agent target/jankurai/security
    command -v jankurai >/dev/null 2>&1 || bash scripts/install-jankurai.sh
    echo "Running jankurai security lane..."
    jankurai security run . --out target/jankurai/security/evidence.json || true
    jankurai audit . --mode advisory --json agent/repo-score.json --md agent/repo-score.md || true

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

