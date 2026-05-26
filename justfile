# Qesto development toolchain
# Canonical proof lanes: setup · check · test · verify · fast · score · security
# Run: just <target>

set shell := ["bash", "-c"]

# Environment check — verify local setup matches CI
doctor:
    bash scripts/ci-doctor.sh

# One-command setup (deps + git hooks)
setup:
    npm ci
    git config core.hooksPath ops/git-hooks

# Fast typecheck + unit tests (pre-commit default)
check:
    npm run typecheck
    npm run check:contracts
    npm test

# Unit tests only
test:
    npm test

# Narrow agent iteration lane (typecheck + contracts, no full test suite)
fast:
    npm run typecheck
    npm run check:contracts

# Full verification: quality gates + build
verify:
    bash ops/ci/quality-gates.sh
    npm run build

# Jankurai repo score (JSON + Markdown artifacts)
score:
    bash ops/ci/jankurai.sh

# Pre-push quality gates (type check + test)
quality-gates:
    bash ops/ci/quality-gates.sh

# Security audit lane
security:
    bash ops/ci/secret-scan.sh
    bash ops/ci/supply-chain.sh

# Run dev server (frontend only)
dev-frontend:
    npm run dev

# Run dev server (full stack with local wrangler)
dev-stack:
    wrangler pages dev

# Clean build artifacts
clean:
    rm -rf dist/ node_modules/.vite/ .cloudflare/ agent/ target/

default: check
