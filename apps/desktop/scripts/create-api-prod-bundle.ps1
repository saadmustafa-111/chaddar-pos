$ErrorActionPreference = 'Stop'

$repoRoot = $env:GITHUB_WORKSPACE
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
}

$apiRoot = Join-Path $repoRoot "apps\api"
$apiDist = Join-Path $apiRoot "dist"
$apiBundle = Join-Path $apiRoot "prod-bundle"
$stageRoot = Join-Path $env:RUNNER_TEMP "steelchaddar-api-bundle"

Write-Host "=== DIAGNOSTIC: Absolute paths ==="
Write-Host "repoRoot: $repoRoot"
Write-Host "apiRoot: $apiRoot"
Write-Host "apiDist: $apiDist"
Write-Host "apiBundle: $apiBundle"
Write-Host "stageRoot (OUTSIDE workspace): $stageRoot"
Write-Host "Current directory: $(Get-Location)"

Write-Host "`n=== Step 1: Clean old bundles and staging ==="
if (Test-Path $apiBundle) { Remove-Item -Path $apiBundle -Recurse -Force }
if (Test-Path $stageRoot) { Remove-Item -Path $stageRoot -Recurse -Force }
Write-Host "Cleanup complete"

Write-Host "`n=== Step 2: Create temporary isolated stage outside workspace ==="
New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
Write-Host "Stage root: $stageRoot"
Write-Host "Is stage outside repo: $($stageRoot -notlike '*chaddar-pos*')"

Write-Host "`n=== Step 3: Create stage/package.json using actual API production dependencies ==="
$apiPkg = Join-Path $apiRoot "package.json"
$pkg = Get-Content $apiPkg -Raw | ConvertFrom-Json

$runtimeDeps = @{}
foreach ($key in $pkg.dependencies.PSObject.Properties.Name) {
    $val = $pkg.dependencies.$key
    if ($key -match "^@types/") {
        Write-Host "SKIPPING production dependency (types): $key"
        continue
    }
    $runtimeDeps[$key] = $val
}

$deployPkg = @{
    name = "api-bundle"
    version = $pkg.version
    main = "main"
    dependencies = $runtimeDeps
    scripts = @{ start = "node main" }
    private = $true
}

$stagePkgJson = Join-Path $stageRoot "package.json"
$deployPkgJson = $deployPkg | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($stagePkgJson, $deployPkgJson)
Write-Host "Created stage/package.json with $($runtimeDeps.Count) runtime dependencies"
Write-Host "Dependencies: $($runtimeDeps.Keys -join ', ')"

Write-Host "`n=== Step 3b: Create .npmrc for hoisted install in staging ==="
$stageNpmrc = Join-Path $stageRoot ".npmrc"
$npmrcContent = @"
shamefully-hoist=true
node-linker=hoisted
"@
[System.IO.File]::WriteAllText($stageNpmrc, $npmrcContent)

Write-Host "`n=== Step 4: Install dependencies in stage ==="
Push-Location $stageRoot
try {
    pnpm install --prod --no-frozen-lockfile 2>&1 | ForEach-Object { Write-Host "pnpm: $_" }
    if ($LASTEXITCODE -ne 0) { throw "pnpm install failed in staging" }
} finally {
    Pop-Location
}
Write-Host "pnpm install complete"

Write-Host "`n=== Step 5: Verify stage/node_modules exists ==="
$stageNodeModules = Join-Path $stageRoot "node_modules"
if (!(Test-Path $stageNodeModules)) { throw "pnpm install did not create node_modules in staging" }
Write-Host "stage/node_modules: PASS"

Write-Host "`n=== Step 5b: Verify no broken symlinks in staging ==="
$brokenLinks = Get-ChildItem -Path $stageNodeModules -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.Attributes -match "ReparsePoint" -and !(Test-Path $_.FullName) }
if ($brokenLinks) {
    Write-Host "WARNING: Found $($brokenLinks.Count) broken symlinks in staging"
    $brokenLinks | Select-Object -First 5 | ForEach-Object { Write-Host "  $($_.FullName)" }
    throw "Staging contains broken symlinks"
}
Write-Host "No broken symlinks in staging: PASS"

Write-Host "`n=== Step 6: Create fresh apps/api/prod-bundle ==="
New-Item -ItemType Directory -Path $apiBundle -Force | Out-Null
Write-Host "prod-bundle directory created"

Write-Host "`n=== Step 7: Copy dist contents into prod-bundle ==="
Copy-Item -Path "$apiDist\*" -Destination $apiBundle -Recurse -Force
$mainPath = Join-Path $apiBundle "main.js"
if (!(Test-Path $mainPath)) { throw "dist copy failed: main.js not at bundle root" }
Write-Host "dist files copied: PASS"

Write-Host "`n=== Step 8: Copy stage/package.json into prod-bundle ==="
$stagePkg = Join-Path $stageRoot "package.json"
if (!(Test-Path $stagePkg)) { throw "STAGING package.json MISSING before cleanup" }
Write-Host "Stage package.json confirmed EXISTS before copy"

Copy-Item -Path $stagePkg -Destination (Join-Path $apiBundle "package.json") -Force
Write-Host "stage/package.json → prod-bundle/package.json: PASS"

Write-Host "`n=== Step 9: Copy stage/node_modules into prod-bundle ==="
$bundleNodeModules = Join-Path $apiBundle "node_modules"
if (Test-Path $bundleNodeModules) { Remove-Item -Path $bundleNodeModules -Recurse -Force }
Copy-Item -Path $stageNodeModules -Destination $bundleNodeModules -Recurse -Force
if (!(Test-Path $bundleNodeModules)) { throw "Bundle missing node_modules after copy from staging" }
Write-Host "stage/node_modules → prod-bundle/node_modules: PASS"

Write-Host "`n=== Step 10: Cleanup staging ==="
if (Test-Path $stageRoot) { Remove-Item -Path $stageRoot -Recurse -Force }
Write-Host "Staging cleaned up"

Write-Host "`n=== FINAL BUNDLE ASSEMBLY ==="
Write-Host "Contents of prod-bundle:"
Get-ChildItem -Path $apiBundle -Force | Select-Object Name, FullName

Write-Host "`nFinal existence checks:"
Write-Host "prod-bundle/main.js: $(Test-Path (Join-Path $apiBundle 'main.js'))"
Write-Host "prod-bundle/package.json: $(Test-Path (Join-Path $apiBundle 'package.json'))"
Write-Host "prod-bundle/node_modules: $(Test-Path (Join-Path $apiBundle 'node_modules'))"

Write-Host "`nVerifying all critical bundle files:"
$checks = @(
    (Join-Path $apiBundle "main.js"),
    (Join-Path $apiBundle "app.module.js"),
    (Join-Path $apiBundle "modules"),
    (Join-Path $apiBundle "package.json")
)
foreach ($check in $checks) {
    if (Test-Path $check) {
        Write-Host "EXISTS: $check"
    } else {
        throw "MISSING CRITICAL FILE: $check"
    }
}

Write-Host "`nBundle structure (first 2 levels):"
Get-ChildItem -Path $apiBundle -Depth 1 | ForEach-Object { Write-Host "  $($_.Name)" }

Write-Host "`nAPI production bundle created: PASS"
