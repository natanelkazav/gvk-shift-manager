param(
  [ValidateSet('quick','server','db','e2e','all')]
  [string]$Mode = 'quick'
)

$ErrorActionPreference = 'Stop'

function Run-Step([string]$Title, [scriptblock]$Action) {
  Write-Host "`n=== $Title ===" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "$Title failed with exit code $LASTEXITCODE"
  }
}

if ($Mode -in @('quick','all')) {
  Run-Step 'Quality gate' { npm run test:quality }
}

if ($Mode -in @('server','all')) {
  Run-Step 'Remote Supabase smoke (read-only)' { npm run test:smoke }
}

if ($Mode -in @('db','all')) {
  Run-Step 'Local database replay + pgTAP' { npm run test:db:reset }
}

if ($Mode -in @('e2e','all')) {
  if (-not (Test-Path 'node_modules/@playwright/test')) {
    Write-Host 'Playwright is not installed. Installing it without saving to package.json...' -ForegroundColor Yellow
    npm install --no-save @playwright/test@1.55.0
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npx playwright install chromium
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  Run-Step 'Browser E2E' { npx playwright test }
}

Write-Host "`nAll requested test layers passed." -ForegroundColor Green
