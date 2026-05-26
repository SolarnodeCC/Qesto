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

report_success "Contracts lane passed"
exit 0

