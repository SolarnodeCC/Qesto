# Create stacked PRs for Sprints 46-50. Requires: gh auth login
# Run from repo root: pwsh scripts/create-sprint-46-50-prs.ps1

$ErrorActionPreference = "Stop"
gh auth status

$prs = @(
  @{
    Base  = "feat/sprint-45-sdks-partners"
    Head  = "feat/sprint-46-perf-multiregion"
    Title = "feat(sprint-46): perf indices and multi-region foundation"
    Body  = @"
## Summary
- D1 perf indices migration
- Multi-region config + health fields
- Admin latency dashboard (ADR-0022)

## Test plan
- [ ] ``npm run typecheck``
- [ ] ``npm test``
"@
  },
  @{
    Base  = "feat/sprint-46-perf-multiregion"
    Head  = "feat/sprint-47-v26-rc"
    Title = "feat(sprint-47): v2.6 RC and compliance roadmap"
    Body  = @"
## Summary
- SOC2 Type II roadmap, pen-test scope
- Admin perf reporting endpoint
- v2.6.0-RC release notes

## Test plan
- [ ] ``npm test``
"@
  },
  @{
    Base  = "feat/sprint-47-v26-rc"
    Head  = "feat/sprint-48-multiregion-api-v2"
    Title = "feat(sprint-48): API v2 realtime and multi-region opt-in"
    Body  = @"
## Summary
- ``GET /api/v2/sessions/:id/realtime`` (ADR-0024)
- Admin multi-region team opt-in routes

## Test plan
- [ ] API key + live session → realtime URL returned
"@
  },
  @{
    Base  = "feat/sprint-48-multiregion-api-v2"
    Head  = "feat/sprint-49-observability-hardening"
    Title = "feat(sprint-49): tracing, sub100ms proof, activation funnel"
    Body  = @"
## Summary
- Distributed trace headers (x-parent-trace-id)
- ``GET /api/admin/perf/sub100ms-proof``
- Activation funnel analytics + security headers

## Test plan
- [ ] ``npm test -- tests/unit/distributed-trace.test.ts``
"@
  },
  @{
    Base  = "feat/sprint-49-observability-hardening"
    Head  = "feat/sprint-50-v30-rc"
    Title = "feat(sprint-50): v3.0 RC and launch pack"
    Body  = @"
## Summary
- v3.0.0-RC release notes
- Partner tiers + marketing launch pack

## Test plan
- [ ] Review release notes and partner docs
- [ ] Full CI on stacked merge path
"@
  }
)

foreach ($pr in $prs) {
  Write-Host "Creating PR: $($pr.Head) -> $($pr.Base) ..."
  gh pr create --base $pr.Base --head $pr.Head --title $pr.Title --body $pr.Body
}

Write-Host "Done. List:"
gh pr list --limit 15
