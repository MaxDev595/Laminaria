$ErrorActionPreference = "Continue"

Write-Host "Checking Vercel network from this computer..." -ForegroundColor Cyan

$targets = @(
  "https://vercel.com",
  "https://api.vercel.com",
  "https://registry.npmjs.org/vercel"
)

foreach ($target in $targets) {
  Write-Host ""
  Write-Host $target -ForegroundColor Yellow
  try {
    $response = Invoke-WebRequest -Uri $target -Method Head -TimeoutSec 20 -UseBasicParsing
    Write-Host "OK HTTP $($response.StatusCode)" -ForegroundColor Green
  } catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "If api.vercel.com fails, try another network, VPN, or disable proxy/firewall for Node/Vercel CLI." -ForegroundColor Cyan
