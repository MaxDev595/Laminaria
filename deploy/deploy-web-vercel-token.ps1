$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Checking local web build..." -ForegroundColor Cyan
.\pnpm.cmd --filter @laminaria/web typecheck
.\pnpm.cmd --filter @laminaria/web build

Write-Host ""
Write-Host "Paste your Vercel token." -ForegroundColor Yellow
Write-Host "Create it here: https://vercel.com/account/settings/tokens" -ForegroundColor Cyan
$secureToken = Read-Host "VERCEL_TOKEN" -AsSecureString
$token = [System.Net.NetworkCredential]::new("", $secureToken).Password

if ([string]::IsNullOrWhiteSpace($token)) {
  throw "VERCEL_TOKEN is empty."
}

$env:VERCEL_TOKEN = $token.Trim()
$env:NO_PROXY = "*"

Write-Host ""
Write-Host "Starting Vercel deploy with token..." -ForegroundColor Cyan
try {
  .\pnpm.cmd dlx vercel@latest --prod --token $env:VERCEL_TOKEN
} finally {
  Remove-Item Env:\VERCEL_TOKEN -ErrorAction SilentlyContinue
}
