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

# Read the vector file
$vectorData = Get-Content '.kb-vectors-pending.json' -Raw

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

# Upload vectors
$startTime = Get-Date
try {
    $response = Invoke-RestMethod `
        -Uri "http://localhost:8787/api/admin/kb-sync" `
        -Method POST `
        -Headers $headers `
        -Body $vectorData `
        -TimeoutSec 300
    
    $endTime = Get-Date
    $elapsed = ($endTime - $startTime).TotalSeconds
    
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json | Write-Host
    Write-Host ""
    Write-Host "Time elapsed: ${elapsed}s" -ForegroundColor Green
}
catch {
    $endTime = Get-Date
    $elapsed = ($endTime - $startTime).TotalSeconds
    
    Write-Host "❌ FAILED" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Time elapsed: ${elapsed}s" -ForegroundColor Red
}

# Stop wrangler dev
Write-Host ""
Write-Host "Stopping wrangler dev..." -ForegroundColor Yellow
Stop-Process -Id $wranglerProcess.Id -Force
Start-Sleep -Seconds 2

Write-Host "Done!" -ForegroundColor Green