$ErrorActionPreference = 'Stop'

$repoRoot = $env:GITHUB_WORKSPACE
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
}

$apiRoot = Join-Path $repoRoot "apps\api"
$apiDist = Join-Path $apiRoot "dist"
$apiBundle = Join-Path $apiRoot "prod-bundle"
$bundleStage = Join-Path $repoRoot "apps\api-bundle-stage"

Write-Host "=== DIAGNOSTIC: Absolute paths ==="
Write-Host "repoRoot: $repoRoot"
Write-Host "apiBundle: $apiBundle"
Write-Host "bundleStage: $bundleStage"

Write-Host "`n=== Removing old bundle and stage ==="
if (Test-Path $apiBundle) { Remove-Item -Path $apiBundle -Recurse -Force }
if (Test-Path $bundleStage) { Remove-Item -Path $bundleStage -Recurse -Force }

Write-Host "`n=== Copying dist to bundle ==="
New-Item -ItemType Directory -Path $apiBundle -Force | Out-Null
Copy-Item -Path "$apiDist\*" -Destination $apiBundle -Recurse -Force

Write-Host "`n=== DIAGNOSTIC: Bundle after dist copy ==="
Get-ChildItem -Path $apiBundle -Recurse -Depth 3 | Select-Object -ExpandProperty FullName | Select-Object -First 30 | ForEach-Object { Write-Host "  $_" }

$mainPath = Join-Path $apiBundle "main.js"
if (!(Test-Path $mainPath)) { throw "dist copy failed: main.js not at bundle root" }
Write-Host "main.js confirmed at bundle root."

Write-Host "`n=== Creating package.json for standalone bundle ==="
$apiPkg = Join-Path $apiRoot "package.json"
$pkg = Get-Content $apiPkg -Raw | ConvertFrom-Json
$deployPkg = @{
    name = $pkg.name
    version = $pkg.version
    main = $pkg.main
    dependencies = $pkg.dependencies
    scripts = @{ start = "node main" }
    private = $true
}
$deployPkgJson = $deployPkg | ConvertTo-Json -Depth 10
$bundlePkgJson = Join-Path $apiBundle "package.json"
[System.IO.File]::WriteAllText($bundlePkgJson, $deployPkgJson)

Write-Host "`n=== Creating standalone .npmrc to prevent workspace awareness ==="
$bundleNpmrc = Join-Path $apiBundle ".npmrc"
$npmrcContent = @"
shamefully-hoist=true
node-linker=hoisted
"@
[System.IO.File]::WriteAllText($bundleNpmrc, $npmrcContent)

Write-Host "`n=== Copying lockfile for reproducible installs ==="
$rootLock = Join-Path $repoRoot "pnpm-lock.yaml"
$bundleLock = Join-Path $apiBundle "pnpm-lock.yaml"
if (Test-Path $rootLock) { Copy-Item -Path $rootLock -Destination $bundleLock -Force }

Write-Host "`n=== Creating STAGING bundle OUTSIDE workspace for isolated pnpm install ==="
New-Item -ItemType Directory -Path $bundleStage -Force | Out-Null
Copy-Item -Path "$apiBundle\*" -Destination $bundleStage -Recurse -Force
$stageNpmrc = Join-Path $bundleStage ".npmrc"
$stageNpmrcContent = @"
shamefully-hoist=true
node-linker=hoisted
"@
[System.IO.File]::WriteAllText($stageNpmrc, $stageNpmrcContent)

Write-Host "`n=== Running pnpm install in STAGING (outside workspace) ==="
Write-Host "PWD before: $(Get-Location)"
Push-Location $bundleStage
try {
    Write-Host "Running pnpm install in: $(Get-Location)"
    pnpm install --prod 2>&1 | ForEach-Object { Write-Host "pnpm: $_" }
    if ($LASTEXITCODE -ne 0) { throw "pnpm install failed in staging" }
} finally {
    Pop-Location
}
Write-Host "PWD after: $(Get-Location)"

Write-Host "`n=== Verifying node_modules in staging ==="
$stageNodeModules = Join-Path $bundleStage "node_modules"
if (!(Test-Path $stageNodeModules)) {
    throw "pnpm install did not create node_modules in staging"
}
Write-Host "node_modules created in staging: PASS"

Write-Host "`n=== DIAGNOSTIC: Staging contents after install ==="
Get-ChildItem -Path $bundleStage -Depth 2 | Select-Object -ExpandProperty FullName | Select-Object -First 30 | ForEach-Object { Write-Host "  $_" }

Write-Host "`n=== Verifying critical modules in staging node_modules ==="
$stageNestjs = Join-Path $stageNodeModules "@nestjs\core"
$stageBetter = Join-Path $stageNodeModules "better-sqlite3"
if (!(Test-Path $stageNestjs)) { throw "Staging missing @nestjs/core" }
if (!(Test-Path $stageBetter)) { throw "Staging missing better-sqlite3" }
Write-Host "@nestjs/core in staging: PASS"
Write-Host "better-sqlite3 in staging: PASS"

Write-Host "`n=== Copying node_modules from staging to bundle ==="
$bundleNodeModules = Join-Path $apiBundle "node_modules"
if (Test-Path $bundleNodeModules) { Remove-Item -Path $bundleNodeModules -Recurse -Force }
Copy-Item -Path $stageNodeModules -Destination $bundleNodeModules -Recurse -Force

Write-Host "`n=== Cleaning up staging ==="
if (Test-Path $bundleStage) { Remove-Item -Path $bundleStage -Recurse -Force }

Write-Host "`n=== Verifying bundle has standalone node_modules ==="
if (!(Test-Path $bundleNodeModules)) { throw "Bundle missing node_modules after copy from staging" }
Write-Host "bundle/node_modules: PASS"

Write-Host "`n=== Verifying no broken symlinks in bundle ==="
$brokenLinks = Get-ChildItem -Path $bundleNodeModules -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.Attributes -match "ReparsePoint" -and !(Test-Path $_.FullName) }
if ($brokenLinks) {
    Write-Host "WARNING: Found $($brokenLinks.Count) broken symlinks"
    $brokenLinks | Select-Object -First 5 | ForEach-Object { Write-Host "  $($_.FullName)" }
    throw "Bundle contains broken symlinks"
}
Write-Host "No broken symlinks: PASS"

Write-Host "`n=== Verifying all critical files after install ==="
$checks = @(
    (Join-Path $apiBundle "main.js"),
    (Join-Path $apiBundle "app.module.js"),
    (Join-Path $apiBundle "modules"),
    (Join-Path $apiBundle "package.json"),
    (Join-Path $apiBundle "node_modules\@nestjs\core"),
    (Join-Path $apiBundle "node_modules\better-sqlite3")
)
foreach ($check in $checks) {
    if (Test-Path $check) {
        Write-Host "EXISTS: $check"
    } else {
        throw "MISSING: $check"
    }
}

Write-Host "`nBundle structure (first 2 levels):"
Get-ChildItem -Path $apiBundle -Depth 1 | ForEach-Object { Write-Host "  $($_.Name)" }

Write-Host "API production bundle created: PASS"
