$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Checking local web build..." -ForegroundColor Cyan
.\pnpm.cmd --filter @laminaria/web typecheck
.\pnpm.cmd --filter @laminaria/web build

Write-Host ""
Write-Host "Starting Vercel deploy..." -ForegroundColor Cyan
Write-Host "If the browser opens, log in and come back to this terminal." -ForegroundColor Yellow
Remove-Item Env:\VERCEL_TOKEN -ErrorAction SilentlyContinue
.\pnpm.cmd dlx vercel@latest login
.\pnpm.cmd dlx vercel@latest --prod
