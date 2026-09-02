$ErrorActionPreference = 'Stop'

$repoRoot = $env:GITHUB_WORKSPACE
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
}

$apiRoot = Join-Path $repoRoot "apps\api"
$apiDist = Join-Path $apiRoot "dist"
$apiBundle = Join-Path $apiRoot "prod-bundle"

Write-Host "=== DIAGNOSTIC: Absolute paths ==="
Write-Host "repoRoot: $repoRoot"
Write-Host "apiRoot: $apiRoot"
Write-Host "apiDist: $apiDist"
Write-Host "apiBundle: $apiBundle"

if (Test-Path $apiBundle) { Remove-Item -LiteralPath $apiBundle -Recurse -Force }
New-Item -ItemType Directory -LiteralPath $apiBundle -Force | Out-Null

Write-Host "`n=== DIAGNOSTIC: API dist contents ==="
Get-ChildItem -LiteralPath $apiDist -Recurse -Depth 3 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName | Select-Object -First 50 | ForEach-Object { Write-Host "  $_" }

Write-Host "`n=== DIAGNOSTIC: Looking for main.js in dist ==="
$mainCandidates = Get-ChildItem -LiteralPath $apiDist -Recurse -Filter "main.js" -File -ErrorAction SilentlyContinue
Write-Host "Found $($mainCandidates.Count) main.js file(s):"
$mainCandidates | ForEach-Object { Write-Host "  $($_.FullName)" }

if ($mainCandidates.Count -eq 0) {
    throw "No compiled main.js found under API dist"
}

Write-Host "`nCopying dist contents into bundle root..."
Copy-Item -Path "$apiDist\*" -Destination $apiBundle -Recurse -Force

Write-Host "`n=== DIAGNOSTIC: Bundle immediately after dist copy ==="
Get-ChildItem -LiteralPath $apiBundle -Recurse -Depth 3 | Select-Object -ExpandProperty FullName | Select-Object -First 50 | ForEach-Object { Write-Host "  $_" }

$mainPath = Join-Path $apiBundle "main.js"
if (!(Test-Path -LiteralPath $mainPath)) {
    throw "dist copy failed: main.js was not copied to bundle root"
}
Write-Host "main.js confirmed at bundle root after copy."

Write-Host "Creating bundle package.json..."
$apiPkg = Join-Path $apiRoot "package.json"
$pkg = Get-Content $apiPkg -Raw | ConvertFrom-Json
$deployPkg = @{
    name = $pkg.name
    version = $pkg.version
    main = $pkg.main
    dependencies = $pkg.dependencies
    scripts = @{ start = "node main" }
}
$deployPkgJson = $deployPkg | ConvertTo-Json -Depth 10
$bundlePkgJson = Join-Path $apiBundle "package.json"
[System.IO.File]::WriteAllText($bundlePkgJson, $deployPkgJson)

Write-Host "Creating bundle .npmrc with hoisting..."
$bundleNpmrc = Join-Path $apiBundle ".npmrc"
$npmrcContent = "shamefully-hoist=true`n"
[System.IO.File]::WriteAllText($bundleNpmrc, $npmrcContent)

Write-Host "`n=== DIAGNOSTIC: PWD before pnpm: $(Get-Location) ==="
Write-Host "apiBundle absolute: $apiBundle"

Push-Location $apiBundle
try {
    Write-Host "Running pnpm install in: $(Get-Location)"
    pnpm install --prod --ignore-scripts 2>&1 | ForEach-Object { Write-Host "pnpm: $_" }
    if ($LASTEXITCODE -ne 0) { throw "pnpm install --prod failed in bundle" }
} finally {
    Pop-Location
}

Write-Host "`n=== DIAGNOSTIC: PWD after pnpm: $(Get-Location) ==="
Write-Host "apiBundle absolute after pnpm: $apiBundle"

Write-Host "`n=== DIAGNOSTIC: Bundle after pnpm install ==="
Get-ChildItem -LiteralPath $apiBundle -Recurse -Depth 2 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName | Select-Object -First 50 | ForEach-Object { Write-Host "  $_" }

Write-Host "`n=== DIAGNOSTIC: Hard-checking critical files after pnpm install ==="
$packagePath = Join-Path $apiBundle "package.json"
$nodeModulesPath = Join-Path $apiBundle "node_modules"

if (!(Test-Path -LiteralPath $mainPath)) {
    throw "Bundle missing main.js after pnpm install: $mainPath"
}
Write-Host "EXISTS: $mainPath"

if (!(Test-Path -LiteralPath $packagePath)) {
    throw "Bundle missing package.json after pnpm install: $packagePath"
}
Write-Host "EXISTS: $packagePath"

if (!(Test-Path -LiteralPath $nodeModulesPath)) {
    throw "Bundle missing node_modules after pnpm install: $nodeModulesPath"
}
Write-Host "EXISTS: $nodeModulesPath"

$brokenLinks = Get-ChildItem -LiteralPath $nodeModulesPath -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.Attributes -match "ReparsePoint" -and !(Test-Path $_.FullName) }
if ($brokenLinks) {
    Write-Host "WARNING: Found $($brokenLinks.Count) broken symlinks"
    $brokenLinks | Select-Object -First 5 | ForEach-Object { Write-Host "  $($_.FullName)" }
    throw "Bundle contains broken symlinks"
}
Write-Host "No broken symlinks - bundle is clean."

Write-Host "Bundle structure (first 2 levels):"
Get-ChildItem -LiteralPath $apiBundle -Depth 1 | ForEach-Object { Write-Host "  $($_.Name)" }

Write-Host "API production bundle created: PASS"
