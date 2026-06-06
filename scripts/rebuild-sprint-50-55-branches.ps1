# Rebuild stacked sprint branches 50-55 from feat/sprint-55-v33-tournaments-coaching (full build).
# Fixes truncated app.ts from earlier split script.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$source = 'feat/sprint-55-v33-tournaments-coaching'
if (-not (git rev-parse --verify $source 2>$null)) {
  Write-Error "Source branch $source not found. Commit full build first."
}

$allFiles = @(
  'AGENTS.md', 'functions/api/app.ts', 'functions/api/SessionRoom.ts', 'functions/api/realtime.ts',
  'functions/api/lib/multi-region.ts', 'functions/api/lib/multi-region-telemetry.ts', 'functions/api/lib/d1-write-context.ts',
  'functions/api/lib/ldap-sync.ts', 'functions/api/lib/ldap-group-map.ts', 'functions/api/lib/webhook-rate-limit.ts',
  'functions/api/lib/webhooks.ts', 'functions/api/lib/public-api-paths.ts', 'functions/api/lib/observability.ts',
  'functions/api/lib/session-room-cross-region.ts', 'functions/api/lib/tournament-live.ts',
  'functions/api/routes/ldap.ts', 'functions/api/routes/multi-region-admin.ts', 'functions/api/routes/sessions/crud.ts',
  'functions/api/routes/partner-apps.ts', 'functions/api/routes/webhook-admin.ts', 'functions/api/routes/webhook-testing.ts',
  'functions/api/routes/partner-integration-status.ts', 'functions/api/routes/public-api-v2.ts', 'functions/api/routes/tournaments.ts',
  'knowledge-base/governance/OBSIDIAN_KB_STANDARD.md', 'knowledge-base/archive/notion-import',
  'knowledge-base/.obsidian/community-plugins.json', 'knowledge-base/adr/ADR-0022-phase-2-write-routing.md',
  'knowledge-base/adr/ADR-0023-partner-oauth-scoping.md', 'knowledge-base/operations/MULTI_REGION_RUNBOOK.md',
  'knowledge-base/operations/MULTI_REGION_DRILL_CHECKLIST.md', 'knowledge-base/product/planning/SPRINT51_60_PLAN.md',
  'knowledge-base/product/planning/sprints/SPRINT51_IMPLEMENTATION_SPEC.md',
  'knowledge-base/product/planning/sprints/SPRINT52_IMPLEMENTATION_SPEC.md',
  'knowledge-base/product/planning/sprints/SPRINT53_IMPLEMENTATION_SPEC.md',
  'knowledge-base/product/planning/sprints/SPRINT54_IMPLEMENTATION_SPEC.md',
  'knowledge-base/product/planning/sprints/SPRINT55_IMPLEMENTATION_SPEC.md',
  'knowledge-base/product/releases/v3.1.0.md', 'knowledge-base/product/releases/v3.2.0.md',
  'src/components/CoachingCard.tsx', 'src/pages/Dashboard.tsx',
  'tests/unit/multi-region.test.ts', 'tests/unit/ldap-sync.test.ts', 'tests/unit/ldap-group-map.test.ts',
  'tests/unit/webhook-rate-limit.test.ts', 'tests/unit/tournament-live.test.ts', 'tests/unit/session-room-cross-region.test.ts'
)

$s51 = @(
  'AGENTS.md', 'knowledge-base/CONTRIBUTING.md', 'knowledge-base/README.md',
  'knowledge-base/.obsidian/community-plugins.json', 'knowledge-base/adr/ADR-0022-phase-2-write-routing.md',
  'knowledge-base/archive/notion-import', 'knowledge-base/governance/OBSIDIAN_KB_STANDARD.md',
  'knowledge-base/operations/MULTI_REGION_RUNBOOK.md', 'knowledge-base/product/planning/SPRINT51_60_PLAN.md',
  'knowledge-base/product/planning/sprints/SPRINT51_IMPLEMENTATION_SPEC.md', 'knowledge-base/product/releases/v3.1.0.md',
  'functions/api/lib/multi-region.ts', 'functions/api/lib/multi-region-telemetry.ts', 'functions/api/lib/d1-write-context.ts',
  'functions/api/routes/multi-region-admin.ts', 'functions/api/routes/sessions/crud.ts',
  'functions/api/lib/ldap-sync.ts', 'functions/api/lib/ldap-group-map.ts', 'functions/api/routes/ldap.ts',
  'tests/unit/multi-region.test.ts', 'tests/unit/ldap-sync.test.ts', 'functions/api/lib/observability.ts'
)

$s52 = @(
  'knowledge-base/operations/MULTI_REGION_DRILL_CHECKLIST.md',
  'knowledge-base/product/planning/sprints/SPRINT52_IMPLEMENTATION_SPEC.md',
  'functions/api/lib/session-room-cross-region.ts', 'tests/unit/session-room-cross-region.test.ts',
  'tests/unit/ldap-group-map.test.ts'
)

$s53 = @(
  'functions/api/lib/webhook-rate-limit.ts', 'functions/api/lib/webhooks.ts', 'functions/api/lib/public-api-paths.ts',
  'knowledge-base/product/planning/sprints/SPRINT53_IMPLEMENTATION_SPEC.md', 'tests/unit/webhook-rate-limit.test.ts'
)

$s54 = @(
  'functions/api/routes/partner-apps.ts', 'functions/api/routes/webhook-admin.ts',
  'functions/api/routes/webhook-testing.ts', 'functions/api/routes/partner-integration-status.ts',
  'functions/api/routes/public-api-v2.ts', 'knowledge-base/adr/ADR-0023-partner-oauth-scoping.md',
  'knowledge-base/product/releases/v3.2.0.md', 'knowledge-base/product/planning/sprints/SPRINT54_IMPLEMENTATION_SPEC.md'
)

$s55 = @(
  'functions/api/SessionRoom.ts', 'functions/api/realtime.ts', 'functions/api/routes/tournaments.ts',
  'functions/api/lib/tournament-live.ts', 'src/components/CoachingCard.tsx', 'src/pages/Dashboard.tsx',
  'knowledge-base/product/planning/sprints/SPRINT55_IMPLEMENTATION_SPEC.md',
  'tests/unit/tournament-live.test.ts', 'public/locales/en/insights.json', 'public/locales/nl/insights.json',
  'public/locales/de/insights.json', 'public/locales/es/insights.json', 'public/locales/fr/insights.json'
)

function Apply-FromSource([string]$branch, [string[]]$paths) {
  foreach ($p in $paths) {
    git checkout $source -- $p 2>$null
  }
}

function Commit-IfDirty([string]$msg, [string[]]$paths) {
  foreach ($p in $paths) { git add -- $p }
  if (git status --porcelain) { git commit -m $msg }
}

git checkout main
git checkout -B feat/sprint-50-v30-rc main
git checkout $source -- knowledge-base/product/planning/sprints/SPRINT50_IMPLEMENTATION_SPEC.md 2>$null
Commit-IfDirty 'docs(sprint-50): align spec on v3.0 RC branch' @('knowledge-base/product/planning/sprints/SPRINT50_IMPLEMENTATION_SPEC.md')

git checkout -B feat/sprint-51-v31-multi-region-ldap main
Apply-FromSource '' $s51
git checkout $source -- functions/api/app.ts
# S51 app: health snapshot only — restore main app then patch import
git show main:functions/api/app.ts | Set-Content functions/api/app.ts -Encoding utf8
$app = Get-Content functions/api/app.ts -Raw
$app = $app -replace 'getMultiRegionConfig, resolveReadRegion', 'getMultiRegionRoutingSnapshot'
$app = $app -replace "app\.get\('/api/admin/health', \(c\) => \{", "app.get('/api/admin/health', async (c) => {"
$app = $app -replace 'const mr = getMultiRegionConfig\(c\.env\)', 'const routing = await getMultiRegionRoutingSnapshot(c.env, colo)'
$app = $app -replace 'readRegion: resolveReadRegion\(colo, mr\),\s+multiRegion: mr,', 'readRegion: routing.readRegion,`n        writeRegion: routing.writeRegion,`n        failoverActive: routing.failoverActive,`n        multiRegion: routing.config,'
Set-Content functions/api/app.ts $app -NoNewline -Encoding utf8
Commit-IfDirty 'feat(sprint-51): Obsidian KB, multi-region write, LDAP sync' ($s51 + 'functions/api/app.ts')

git checkout -B feat/sprint-52-v31-ldap-drill feat/sprint-51-v31-multi-region-ldap
Apply-FromSource '' $s52
Commit-IfDirty 'feat(sprint-52): LDAP group map, DO cross-region mirror, drill checklist' $s52

git checkout -B feat/sprint-53-v32-webhooks feat/sprint-52-v31-ldap-drill
Apply-FromSource '' $s53
git checkout $source -- functions/api/app.ts
Commit-IfDirty 'feat(sprint-53): webhooks rate limit, delivery events, public API paths' ($s53 + 'functions/api/app.ts')

git checkout -B feat/sprint-54-v32-partner-oauth feat/sprint-53-v32-webhooks
Apply-FromSource '' $s54
git checkout $source -- functions/api/app.ts
Commit-IfDirty 'feat(sprint-54): partner apps, webhook test runner, API v2 expand' ($s54 + 'functions/api/app.ts')

git checkout -B feat/sprint-55-v33-tournaments-coaching feat/sprint-54-v32-partner-oauth
Apply-FromSource '' $s55
git checkout $source -- functions/api/app.ts
Commit-IfDirty 'feat(sprint-55): LIVE tournaments, coaching card, i18n' ($s55 + 'functions/api/app.ts')

Write-Host 'Rebuilt feat/sprint-50-v30-rc through feat/sprint-55-v33-tournaments-coaching'
