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

Write-Host "`n=== Step 5c: Inspect staging symlink structure ==="
Write-Host "Checking @nestjs/core link type in staging:"
$nestCoreStage = Join-Path $stageNodeModules "@nestjs\core"
if (Test-Path $nestCoreStage) {
    $item = Get-Item $nestCoreStage -Force
    Write-Host "  LinkType: $($item.LinkType)"
    Write-Host "  Target: $($item.Target)"
} else {
    Write-Host "  @nestjs/core NOT FOUND in staging node_modules"
}
Write-Host "Checking node_modules/.pnpm exists:"
$pnpmDir = Join-Path $stageNodeModules ".pnpm"
Write-Host "  .pnpm exists: $(Test-Path $pnpmDir)"
if (Test-Path $pnpmDir) {
    $pnpmCount = (Get-ChildItem $pnpmDir -Force -ErrorAction SilentlyContinue | Measure-Object).Count
    Write-Host "  .pnpm entries: $pnpmCount"
}

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

Write-Host "`n=== Step 9: Copy stage/node_modules into prod-bundle (dereference all junctions/symlinks) ==="
$bundleNodeModules = Join-Path $apiBundle "node_modules"
if (Test-Path $bundleNodeModules) { Remove-Item -Path $bundleNodeModules -Recurse -Force }
New-Item -ItemType Directory -Path $bundleNodeModules -Force | Out-Null

function Copy-DirectoryContentsPhysical($src, $dst) {
    $items = Get-ChildItem -Path $src -Force
    foreach ($item in $items) {
        $srcPath = $item.FullName
        $dstPath = Join-Path $dst $item.Name
        if ($item.Attributes -match "ReparsePoint") {
            if ($item.LinkType -eq "Junction" -or $item.LinkType -eq "SymbolicLink") {
                $target = $item.Target
                Write-Host "  Following junction/symlink: $($item.Name) -> $target"
                $targetItem = Get-Item $target -Force -ErrorAction SilentlyContinue
                if ($targetItem) {
                    if ($targetItem.PSIsContainer) {
                        if (!(Test-Path $dstPath)) { New-Item -ItemType Directory -Path $dstPath -Force | Out-Null }
                        Copy-DirectoryContentsPhysical $target $dstPath
                    } else {
                        Copy-Item -Path $srcPath -Destination $dstPath -Force
                    }
                } else {
                    Write-Host "  WARNING: Junction target inaccessible: $target"
                    Copy-Item -Path $srcPath -Destination $dstPath -Force
                }
                continue
            }
        }
        if ($item.PSIsContainer) {
            if (!(Test-Path $dstPath)) { New-Item -ItemType Directory -Path $dstPath -Force | Out-Null }
            Copy-DirectoryContentsPhysical $srcPath $dstPath
        } else {
            Copy-Item -Path $srcPath -Destination $dstPath -Force
        }
    }
}

Write-Host "Physically copying staging node_modules to prod-bundle (following junctions)..."
Copy-DirectoryContentsPhysical $stageNodeModules $bundleNodeModules
Write-Host "Physical copy complete"

Write-Host "`n=== Step 10: Verify copied @nestjs/core is PHYSICAL (not a symlink) ==="
$nestCoreBundle = Join-Path $bundleNodeModules "@nestjs\core"
if (Test-Path $nestCoreBundle) {
    $item = Get-Item $nestCoreBundle -Force
    Write-Host "  @nestjs/core LinkType: $($item.LinkType)"
    if ($item.LinkType -eq "SymbolicLink" -or $item.LinkType -eq "Junction") {
        Write-Host "  PROBLEM: @nestjs/core is still a $($item.LinkType) pointing to: $($item.Target)"
        throw "prod-bundle/node_modules/@nestjs/core is a symlink/junction - NOT physically self-contained"
    }
    Write-Host "  @nestjs/core is PHYSICAL directory: PASS"
} else {
    throw "prod-bundle/node_modules/@nestjs/core missing after copy"
}

Write-Host "`n=== Step 11: Verify .pnpm does NOT exist in prod-bundle node_modules ==="
$bundlePnpm = Join-Path $bundleNodeModules ".pnpm"
if (Test-Path $bundlePnpm) {
    Write-Host "WARNING: prod-bundle/node_modules/.pnpm exists - this means hoisted structure is wrong"
    Write-Host "Contents: $(Get-ChildItem $bundlePnpm -Force -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count) entries"
} else {
    Write-Host ".pnpm not in prod-bundle/node_modules: PASS (hoisted structure NOT used)"
}

Write-Host "`n=== Step 12: Verify require.resolve works inside prod-bundle for ALL critical packages ==="
Push-Location $apiBundle
$criticalPkgs = @(
    "@nestjs/core",
    "@nestjs/common",
    "@nestjs/platform-express",
    "@nestjs/config",
    "@nestjs/typeorm",
    "typeorm",
    "express-session",
    "reflect-metadata",
    "rxjs",
    "better-sqlite3",
    "bcryptjs"
)
$allPassed = $true
foreach ($pkg in $criticalPkgs) {
    try {
        $resolved = node -e "console.log(require.resolve('$pkg'))"
        Write-Host "  require.resolve('$pkg'): $resolved"
        if ($resolved -notlike "*prod-bundle*") {
            Write-Host "  ERROR: $pkg resolved OUTSIDE prod-bundle!"
            $allPassed = $false
        }
    } catch {
        Write-Host "  FAIL: require.resolve('$pkg') threw: $_"
        $allPassed = $false
    }
}
Pop-Location
if (-not $allPassed) {
    throw "One or more critical packages resolved outside prod-bundle"
}
Write-Host "All critical packages resolve inside prod-bundle: PASS"

Write-Host "`n=== Step 13: Cleanup staging ==="
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
