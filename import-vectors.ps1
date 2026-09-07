# Windows PowerShell script for vector import

Write-Host "📤 Starting wrangler dev server..." -ForegroundColor Green

# Start wrangler dev in background
$wranglerProcess = Start-Process -FilePath "npx" -ArgumentList "wrangler", "dev", "--port", "8787" `
    -WindowStyle Hidden `
    -PassThru

Write-Host "Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "Uploading vectors to Cloudflare Vectorize..." -ForegroundColor Green
Write-Host ""

# Read the vector file. It holds one record per chunk for the whole corpus
# (~480 files, thousands of chunks); a 1024-dim float32 vector serialises to
# roughly 20KB of JSON, so the full payload runs to hundreds of megabytes.
# Posting it in one request exceeds the Worker's body and memory limits, so it
# is sent in batches (audit #17).
$vectors = Get-Content '.kb-vectors-pending.json' -Raw | ConvertFrom-Json
$batchSize = 200

# Set up headers. The admin key comes from the environment — never hardcode it
# here (CLAUDE.md hard rule 2). Set it first:  $env:KB_ADMIN_KEY = "..."
if (-not $env:KB_ADMIN_KEY) {
    Write-Host "KB_ADMIN_KEY is not set. Run: `$env:KB_ADMIN_KEY = '<key>'" -ForegroundColor Red
    exit 1
}

$headers = @{
    "x-admin-key" = $env:KB_ADMIN_KEY
    "Content-Type" = "application/json"
}

# Upload vectors in batches. On failure the offset is printed so the run can be
# resumed instead of restarted from scratch.
$startTime = Get-Date
$total = $vectors.Count
$uploaded = 0

for ($i = 0; $i -lt $total; $i += $batchSize) {
    $end = [Math]::Min($i + $batchSize - 1, $total - 1)
    $batch = $vectors[$i..$end]
    $body = ConvertTo-Json -InputObject $batch -Depth 10 -Compress

    try {
        $response = Invoke-RestMethod `
            -Uri "http://localhost:8787/api/admin/kb-sync" `
            -Method POST `
            -Headers $headers `
            -Body $body `
            -TimeoutSec 300

        $uploaded += $batch.Count
        Write-Host "  ✓ $uploaded / $total vectors" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ FAILED at offset $i" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Uploaded $uploaded of $total before failing." -ForegroundColor Yellow
        break
    }
}

$endTime = Get-Date
$elapsed = ($endTime - $startTime).TotalSeconds
if ($uploaded -eq $total) {
    Write-Host "✅ SUCCESS! $uploaded vectors uploaded." -ForegroundColor Green
}
Write-Host "Time elapsed: ${elapsed}s" -ForegroundColor Green

# Stop wrangler dev
Write-Host ""
Write-Host "Stopping wrangler dev..." -ForegroundColor Yellow
Stop-Process -Id $wranglerProcess.Id -Force
Start-Sleep -Seconds 2

Write-Host "Done!" -ForegroundColor Green