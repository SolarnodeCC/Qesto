#!/bin/bash
# scripts/install-jankurai.sh — Install the jankurai audit CLI (pinned auditor_version)
#
# The pinned version is `auditor_version` in agent/standard-version.toml. The
# `jankurai-workspace` dependency in package.json / package-lock.json vendors the
# matching jankurai hub at a locked commit; since v1.7.x the hub ships an
# installer (not a Cargo workspace), which downloads the release tarball and
# verifies its checksum, signature (pinned release key), provenance and binary
# version before installing.
#
# Order of preference:
#   1. Already installed at the pinned version        → no-op
#   2. Vendored hub present (after `npm ci`)           → locked hub installer
#   3. Otherwise                                       → fail (run `npm ci` first)
#
# Usage: bash scripts/install-jankurai.sh
set -euo pipefail

JANKURAI_VERSION="$(grep -E '^auditor_version' agent/standard-version.toml | sed -E 's/[^"]*"([^"]+)".*/\1/')"
JANKURAI_HUB="node_modules/jankurai-workspace"
INSTALL_DIR="${JANKURAI_INSTALL_DIR:-$HOME/.local/bin}"

if command -v jankurai >/dev/null 2>&1 \
   && jankurai version 2>/dev/null | grep -q "${JANKURAI_VERSION}"; then
  echo "jankurai ${JANKURAI_VERSION} already installed:"
  jankurai version | head -1
  exit 0
fi

if [ ! -f "${JANKURAI_HUB}/jankurai-installer.sh" ]; then
  echo "error: ${JANKURAI_HUB} not found — run 'npm ci' first (the lockfile pins the hub commit)." >&2
  exit 1
fi

HUB_VERSION="$(tr -d '[:space:]' < "${JANKURAI_HUB}/VERSION")"
if [ "${HUB_VERSION}" != "${JANKURAI_VERSION}" ]; then
  echo "error: ${JANKURAI_HUB} is v${HUB_VERSION} but agent/standard-version.toml pins ${JANKURAI_VERSION}." >&2
  exit 1
fi

echo "Installing jankurai v${JANKURAI_VERSION} with the locked hub installer into ${INSTALL_DIR}..."
JANKURAI_RELEASE_TAG="v${JANKURAI_VERSION}" JANKURAI_INSTALL_DIR="${INSTALL_DIR}" \
  bash "${JANKURAI_HUB}/jankurai-installer.sh"

case ":$PATH:" in
  *":${INSTALL_DIR}:"*) ;;
  *) echo "note: add ${INSTALL_DIR} to your PATH to use jankurai." ;;
esac

echo ""
echo "Installed:"
"${INSTALL_DIR}/jankurai" version | head -1
