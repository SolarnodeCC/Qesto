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
    if command -v jankurai >/dev/null 2>&1; then
      jankurai . --json agent/repo-score.json --md agent/repo-score.md
    else
      npx --yes jankurai@1.5.1 . --json agent/repo-score.json --md agent/repo-score.md
    fi

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
    bash scripts/install-git-hooks.sh
    echo "Setup complete. Run 'just doctor' to verify environment."

# Install / refresh git hooks only (pre-push quality gates)
hooks:
    bash scripts/install-git-hooks.sh

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
