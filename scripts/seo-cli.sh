#!/usr/bin/env bash
# Thin wrapper around vendor/claude-seo/bin/claude-seo for Cursor agents and local dev.
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
BIN="${ROOT}/vendor/claude-seo/bin/claude-seo"

if [[ ! -x "${BIN}" ]]; then
  echo "claude-seo vendor missing. Run: npm run seo:setup" >&2
  exit 2
fi

exec "${BIN}" "$@"
