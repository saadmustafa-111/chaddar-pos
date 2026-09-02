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

Write-Host "`n=== Cleaning old bundles ==="
if (Test-Path $apiBundle) { Remove-Item -Path $apiBundle -Recurse -Force }
if (Test-Path $stageRoot) { Remove-Item -Path $stageRoot -Recurse -Force }

Write-Host "`n=== Copying dist to bundle ==="
New-Item -ItemType Directory -Path $apiBundle -Force | Out-Null
Copy-Item -Path "$apiDist\*" -Destination $apiBundle -Recurse -Force

Write-Host "`n=== Verifying main.js at bundle root ==="
$mainPath = Join-Path $apiBundle "main.js"
if (!(Test-Path $mainPath)) { throw "dist copy failed: main.js not at bundle root" }
Write-Host "main.js at bundle root: PASS"

Write-Host "`n=== Creating standalone package in RUNNER_TEMP (genuinely outside workspace) ==="
New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null

Write-Host "=== DIAGNOSTIC: Staging directory structure ==="
Write-Host "Stage root: $stageRoot"
Write-Host "Is stage outside repo: $($stageRoot -notlike '*chaddar-pos*')"

Write-Host "`n=== Creating package.json for isolated bundle ==="
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
Write-Host "Created isolated package.json with $($runtimeDeps.Count) runtime dependencies"
Write-Host "Dependencies: $($runtimeDeps.Keys -join ', ')"

Write-Host "`n=== Creating .npmrc for hoisted install in staging ==="
$stageNpmrc = Join-Path $stageRoot ".npmrc"
$npmrcContent = @"
shamefully-hoist=true
node-linker=hoisted
"@
[System.IO.File]::WriteAllText($stageNpmrc, $npmrcContent)

Write-Host "`n=== Running pnpm install in isolated staging ==="
Write-Host "PWD before: $(Get-Location)"
Write-Host "Installing in: $stageRoot"

Push-Location $stageRoot
try {
    pnpm install --prod --no-frozen-lockfile 2>&1 | ForEach-Object { Write-Host "pnpm: $_" }
    if ($LASTEXITCODE -ne 0) { throw "pnpm install failed in staging" }
} finally {
    Pop-Location
}
Write-Host "PWD after: $(Get-Location)"

Write-Host "`n=== Verifying node_modules created in staging ==="
$stageNodeModules = Join-Path $stageRoot "node_modules"
if (!(Test-Path $stageNodeModules)) { throw "pnpm install did not create node_modules in staging" }
Write-Host "node_modules in staging: PASS"

Write-Host "`n=== Verifying no broken symlinks in staging ==="
$brokenLinks = Get-ChildItem -Path $stageNodeModules -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.Attributes -match "ReparsePoint" -and !(Test-Path $_.FullName) }
if ($brokenLinks) {
    Write-Host "WARNING: Found $($brokenLinks.Count) broken symlinks in staging"
    $brokenLinks | Select-Object -First 5 | ForEach-Object { Write-Host "  $($_.FullName)" }
    throw "Staging contains broken symlinks"
}
Write-Host "No broken symlinks in staging: PASS"

Write-Host "`n=== Copying node_modules from staging to bundle ==="
$bundleNodeModules = Join-Path $apiBundle "node_modules"
if (Test-Path $bundleNodeModules) { Remove-Item -Path $bundleNodeModules -Recurse -Force }
Copy-Item -Path $stageNodeModules -Destination $bundleNodeModules -Recurse -Force

Write-Host "`n=== Cleaning up staging ==="
if (Test-Path $stageRoot) { Remove-Item -Path $stageRoot -Recurse -Force }

Write-Host "`n=== Verifying bundle has standalone node_modules ==="
if (!(Test-Path $bundleNodeModules)) { throw "Bundle missing node_modules after copy from staging" }
Write-Host "bundle/node_modules: PASS"

Write-Host "`n=== Verifying no broken symlinks in bundle ==="
$brokenLinks = Get-ChildItem -Path $bundleNodeModules -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.Attributes -match "ReparsePoint" -and !(Test-Path $_.FullName) }
if ($brokenLinks) {
    Write-Host "WARNING: Found $($brokenLinks.Count) broken symlinks in bundle"
    $brokenLinks | Select-Object -First 5 | ForEach-Object { Write-Host "  $($_.FullName)" }
    throw "Bundle contains broken symlinks"
}
Write-Host "No broken symlinks in bundle: PASS"

Write-Host "`n=== Verifying all critical bundle files ==="
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
        throw "MISSING: $check"
    }
}

Write-Host "`nBundle structure (first 2 levels):"
Get-ChildItem -Path $apiBundle -Depth 1 | ForEach-Object { Write-Host "  $($_.Name)" }

Write-Host "`nAPI production bundle created: PASS"
