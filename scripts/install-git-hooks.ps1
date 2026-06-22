# scripts/install-git-hooks.ps1 — Enable repo-local pre-push quality gates (Windows)
# Requires Git for Windows (bash ships with Git; hooks run under sh/bash).

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$HooksDir = "ops/git-hooks"
$PrePush = Join-Path $HooksDir "pre-push"

if (-not (Test-Path ".git")) {
    Write-Error "Not a git repository: $Root"
}

if (-not (Test-Path $PrePush)) {
    Write-Error "Missing hook: $PrePush"
}

Write-Host "-> Configuring core.hooksPath = $HooksDir (local)"
git config --local core.hooksPath $HooksDir

# Git for Windows respects executable bit via update-index
Write-Host "-> Marking pre-push executable in git index"
git update-index --chmod=+x $PrePush 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "   (update-index skipped — hook may still run via bash)"
}

$current = git config --local --get core.hooksPath
if ($current -ne $HooksDir) {
    Write-Error "core.hooksPath is '$current', expected '$HooksDir'"
}

Write-Host ""
Write-Host "Git hooks installed."
Write-Host ""
Write-Host "  Pre-push lanes (automatic):"
Write-Host "    full - push to main/master, or trust/AI paths (CI parity)"
Write-Host "    fast - feature branches, low-risk diffs (tsc + npm test)"
Write-Host "    skip - knowledge-base / docs only"
Write-Host ""
Write-Host "  Verify:  just doctor"
Write-Host "  Dry run: bash scripts/test-pre-push-hook.sh"
Write-Host ""
