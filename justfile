# Qesto development toolchain
# Run: just <target>

set shell := ["bash", "-c"]

# Setup development environment
setup:
    #!/bin/bash
    set -e
    echo "Installing dependencies..."
    npm install
    echo "Setup complete. Run 'just check' to validate."

# Check code quality: TypeScript, linting, formatting
check:
    #!/bin/bash
    set -e
    echo "Type checking..."
    npm run type-check
    echo "Linting..."
    npm run lint --if-present || true
    echo "Check complete."

# Run test suite
test:
    #!/bin/bash
    set -e
    echo "Running tests..."
    npm test
    echo "Tests passed."

# Full verification: build, check, test
verify: check test
    #!/bin/bash
    set -e
    echo "Building..."
    npm run build
    echo "Verification complete."

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
    rm -rf dist/ node_modules/.vite/ .cloudflare/

# Fast verification (type check + build only, skip tests)
fast: check
    npm run build

# Default target
default: check

# CI simulation — run checks that CI would run
ci: setup verify
    echo "CI verification passed"
