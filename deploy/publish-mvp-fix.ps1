$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$files = @(
  "apps/api/src/realtime/register-realtime.ts",
  "apps/api/src/realtime/types.ts",
  "apps/api/src/realtime/register-realtime.test.ts",
  "apps/api/src/routes/webinars.ts",
  "apps/web/src/app/globals.css",
  "apps/web/src/components/dashboard-overview.tsx",
  "apps/web/src/components/dashboard-section.tsx",
  "apps/web/src/components/dashboard-shell.tsx",
  "apps/web/src/components/room-experience.tsx",
  "apps/web/src/lib/api.ts",
  "deploy/publish-mvp-fix.ps1"
)

Write-Host "Preparing verified Laminaria MVP fixes..." -ForegroundColor Cyan
& git add -- $files
if ($LASTEXITCODE -ne 0) { throw "git add failed" }

& git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "Nothing to publish: these fixes are already committed." -ForegroundColor Green
  exit 0
}

& git commit -m "Fix moderator flow and harden live room recovery"
if ($LASTEXITCODE -ne 0) { throw "git commit failed" }

& git push origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

Write-Host "Published. Vercel and Render can now deploy the new main commit." -ForegroundColor Green
