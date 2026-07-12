$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Resetting invalid Vercel token..." -ForegroundColor Cyan
Remove-Item Env:\VERCEL_TOKEN -ErrorAction SilentlyContinue
.\pnpm.cmd dlx vercel@latest login

Write-Host ""
Write-Host "Now deploy web:" -ForegroundColor Green
Write-Host ".\deploy\deploy-web-vercel.ps1"
