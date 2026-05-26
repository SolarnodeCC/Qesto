#!/bin/bash
# ops/ci/lib.sh — Shared CI helpers and tool version pins
# Source this in every ops/ci/<lane>.sh script

set -e

# ─── Tool Version Pins ────────────────────────────────────────────────────────
# These are the contract between local development and CI.
# If tools change, update both here and in scripts/ci-doctor.sh

NODE_VERSION="20"
NPM_MIN_VERSION="10.0.0"
BASH_MIN_VERSION="5.0"
GIT_MIN_VERSION="2.40"

# ─── Color Output ─────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─── Assertion Helpers ────────────────────────────────────────────────────────

assert_tool() {
  local tool=$1
  if ! command -v "$tool" &> /dev/null; then
    echo -e "${RED}✗ FAIL${NC}: $tool not found. Run: scripts/ci-doctor.sh"
    exit 1
  fi
}

assert_file() {
  local file=$1
  local desc=$2
  if [ ! -f "$file" ]; then
    echo -e "${RED}✗ FAIL${NC}: $desc not found at $file"
    exit 1
  fi
}

assert_node_version() {
  local actual=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$actual" -lt "$NODE_VERSION" ]; then
    echo -e "${RED}✗ FAIL${NC}: Node v$NODE_VERSION required, got v$actual"
    exit 1
  fi
}

# ─── Reporting ────────────────────────────────────────────────────────────────

report_lane_start() {
  local lane=$1
  echo -e "${BLUE}→ $lane${NC}"
}

report_success() {
  local msg=$1
  echo -e "${GREEN}✓${NC} $msg"
}

report_error() {
  local msg=$1
  echo -e "${RED}✗${NC} $msg" >&2
}

# ─── Exit Handling ────────────────────────────────────────────────────────────

on_error() {
  local line=$1
  report_error "CI lane failed at line $line"
  exit 1
}

trap 'on_error $LINENO' ERR

export -f assert_tool assert_file assert_node_version
export -f report_lane_start report_success report_error
export RED GREEN YELLOW BLUE NC
