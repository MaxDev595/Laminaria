$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Checking local API build..." -ForegroundColor Cyan
.\pnpm.cmd db:generate
.\pnpm.cmd --filter @laminaria/api typecheck
.\pnpm.cmd --filter @laminaria/api build

Write-Host ""
Write-Host "Starting Railway deploy..." -ForegroundColor Cyan
Write-Host "If Railway asks you to login, finish login in the browser and return here." -ForegroundColor Yellow
.\pnpm.cmd dlx @railway/cli@latest login
.\pnpm.cmd dlx @railway/cli@latest up
