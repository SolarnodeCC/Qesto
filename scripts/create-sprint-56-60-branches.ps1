# Stack sprints 56-60 on feat/sprint-55-v33-tournaments-coaching using feat/sprint-57-60-v33-v35 as source.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$base = 'feat/sprint-55-v33-tournaments-coaching'
$source = 'feat/sprint-57-60-v33-v35'

$s56 = @(
  'functions/api/lib/coaching-profile.ts', 'functions/api/lib/ai/coaching.ts',
  'functions/api/routes/agent-grounding.ts', 'functions/api/routes/ai-insights/register-coaching.ts',
  'functions/api/routes/tournaments.ts', 'knowledge-base/product/planning/sprints/SPRINT56_IMPLEMENTATION_SPEC.md'
)
$s57 = @(
  'functions/api/lib/coaching-actions.ts', 'functions/api/routes/compliance-admin.ts',
  'knowledge-base/product/planning/sprints/SPRINT57_IMPLEMENTATION_SPEC.md',
  'knowledge-base/product/releases/v3.3.0.md'
)
$s58 = @(
  'functions/api/routes/partner-marketplace.ts', 'functions/api/routes/partner-sla.ts',
  'functions/api/routes/partner-branding.ts', 'src/pages/MarketplacePage.tsx', 'src/pages/PartnerSlaPage.tsx',
  'knowledge-base/security/SOC2_TYPE_II_EVIDENCE', 'knowledge-base/product/planning/sprints/SPRINT58_IMPLEMENTATION_SPEC.md',
  'knowledge-base/product/releases/v3.4.0.md', 'public/locales/en/common.json', 'public/locales/nl/common.json',
  'public/locales/de/common.json', 'public/locales/es/common.json', 'public/locales/fr/common.json'
)
$s59 = @(
  'src/pages/Soc2TrustPage.tsx', 'src/App.tsx', 'src/layouts/MainLayout.tsx',
  'knowledge-base/product/planning/sprints/SPRINT59_IMPLEMENTATION_SPEC.md'
)
$s60 = @(
  'src/components/SimilarSessionsPanel.tsx', 'src/pages/Dashboard.tsx',
  'knowledge-base/product/marketing/COMPETITIVE_MOAT_V35.md',
  'knowledge-base/product/planning/sprints/SPRINT60_IMPLEMENTATION_SPEC.md',
  'knowledge-base/product/releases/v3.5.0.md'
)

function Apply([string[]]$paths) {
  foreach ($p in $paths) { git checkout $source -- $p 2>$null }
}
function Commit([string]$msg, [string[]]$paths) {
  foreach ($p in $paths) { git add -- $p }
  if (git status --porcelain) { git commit -m $msg }
}

git checkout -B feat/sprint-56-v33-rag-coaching $base
Apply $s56
git checkout $source -- functions/api/app.ts functions/api/lib/observability.ts
Commit 'feat(sprint-56): RAG coaching profile + tournament export' ($s56 + 'functions/api/app.ts', 'functions/api/lib/observability.ts')

git checkout -B feat/sprint-57-v33-coaching-ux feat/sprint-56-v33-rag-coaching
Apply $s57
git checkout $source -- functions/api/app.ts src/components/CoachingCard.tsx public/locales/en/insights.json
Commit 'feat(sprint-57): coaching actions, email export, SOC2 prep' ($s57 + 'functions/api/app.ts', 'src/components/CoachingCard.tsx', 'public/locales/en/insights.json')

git checkout -B feat/sprint-58-v34-marketplace-soc2 feat/sprint-57-v33-coaching-ux
Apply $s58
git checkout $source -- functions/api/app.ts functions/api/lib/public-api-paths.ts
Commit 'feat(sprint-58): marketplace, SLA page, partner branding' ($s58 + 'functions/api/app.ts', 'functions/api/lib/public-api-paths.ts')

git checkout -B feat/sprint-59-v34-soc2-gtm feat/sprint-58-v34-marketplace-soc2
Apply $s59
git checkout $source -- functions/api/routes/partner-apps.ts functions/api/app.ts
Commit 'feat(sprint-59): SOC2 trust page, partner secret rotation' ($s59 + 'functions/api/routes/partner-apps.ts', 'functions/api/app.ts')

git checkout -B feat/sprint-60-v35-moat feat/sprint-59-v34-soc2-gtm
Apply $s60
git checkout $source -- functions/api/app.ts
Commit 'feat(sprint-60): similar sessions RAG search, v3.5 moat doc' ($s60 + 'functions/api/app.ts')

Write-Host 'Branches feat/sprint-56 through feat/sprint-60 created.'
