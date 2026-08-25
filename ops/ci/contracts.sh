#!/bin/bash
# ops/ci/contracts.sh — Contract generation drift gate
set -e
source "$(dirname "$0")/lib.sh"

report_lane_start "contracts"
assert_tool node
assert_tool npm
assert_node_version

report_success "Installing dependencies"
npm ci --silent

report_success "Generating OpenAPI-derived types"
npm run contracts:generate

report_success "Checking generated drift"
git diff --exit-code -- contracts/generated

# HLT-007 gate for the second contract surface: contracts/openapi-v3.json is
# generated from functions/api/lib/openapi-v3-spec.ts. docs/ci-local.md listed
# this step, but the npm script did not exist, so it never ran (issue #690).
report_success "Checking OpenAPI artifact drift"
npm run check:contracts

report_success "Contracts lane passed"
exit 0

