#!/bin/bash
# scripts/install-jankurai.sh — Install the jankurai audit CLI (v1.6.10)
#
# jankurai is a Rust CLI. The pinned version is governed by the
# `jankurai-workspace` dependency in package.json / package-lock.json (the v1.6.10
# tag). This script builds and installs the `jankurai` binary with cargo.
#
# Order of preference:
#   1. Already installed at the pinned version           → no-op
#   2. Vendored workspace present (after `npm ci`)        → cargo install --path
#      (version = the lockfile — the single source of truth)
#   3. Fallback                                           → cargo install --git --tag
#
# Usage: bash scripts/install-jankurai.sh
set -euo pipefail

JANKURAI_VERSION="1.6.10"
JANKURAI_TAG="v${JANKURAI_VERSION}"
JANKURAI_REPO="https://github.com/neverhuman/jankurai"
WORKSPACE_CRATE="node_modules/jankurai-workspace/crates/jankurai"

if ! command -v cargo >/dev/null 2>&1; then
  echo "error: cargo (Rust toolchain) is required to build jankurai." >&2
  echo "       install it from https://rustup.rs and re-run." >&2
  exit 1
fi

if command -v jankurai >/dev/null 2>&1 \
   && jankurai version 2>/dev/null | grep -q "${JANKURAI_VERSION}"; then
  echo "jankurai ${JANKURAI_VERSION} already installed:"
  jankurai version | head -1
  exit 0
fi

if [ -d "${WORKSPACE_CRATE}" ]; then
  echo "Building jankurai from the vendored workspace (${WORKSPACE_CRATE}) — version pinned by package-lock.json..."
  cargo install --path "${WORKSPACE_CRATE}" --locked --force
else
  echo "Vendored workspace not found (run 'npm ci' first for lockfile-pinned builds)."
  echo "Falling back to cargo install from the ${JANKURAI_TAG} git tag..."
  cargo install --git "${JANKURAI_REPO}" --tag "${JANKURAI_TAG}" --locked --force jankurai
fi

echo ""
echo "Installed:"
jankurai version | head -1
