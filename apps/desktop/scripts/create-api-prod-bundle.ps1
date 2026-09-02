$ErrorActionPreference = 'Stop'

$apiBundle = "apps/api/prod-bundle"
$apiDist = "apps/api/dist"
$apiPkg = "apps/api/package.json"

Write-Host "Creating API production bundle at $apiBundle"

if (Test-Path $apiBundle) { Remove-Item $apiBundle -Recurse -Force }
New-Item -ItemType Directory -Path $apiBundle -Force | Out-Null

Write-Host "=== DIAGNOSTIC: API dist path: $apiDist"
Write-Host "=== DIAGNOSTIC: API dist contents:"
Get-ChildItem $apiDist -Recurse -Depth 3 | Select-Object -ExpandProperty FullName | Select-Object -First 50 | ForEach-Object { Write-Host "  $_" }

Write-Host "`n=== DIAGNOSTIC: Looking for main.js in dist..."
$mainCandidates = Get-ChildItem $apiDist -Recurse -Filter "main.js" -File -ErrorAction SilentlyContinue
Write-Host "Found $($mainCandidates.Count) main.js file(s):"
$mainCandidates | ForEach-Object { Write-Host "  $($_.FullName)" }

if ($mainCandidates.Count -eq 0) {
    throw "No compiled main.js found under API dist. Build may have failed."
}

Write-Host "`nCopying dist contents into bundle root..."
Copy-Item -Path "$apiDist\*" -Destination $apiBundle -Recurse -Force

Write-Host "`n=== DIAGNOSTIC: Bundle immediately after dist copy:"
Get-ChildItem $apiBundle -Recurse -Depth 3 | Select-Object -ExpandProperty FullName | Select-Object -First 50 | ForEach-Object { Write-Host "  $_" }

if (!(Test-Path (Join-Path $apiBundle "main.js"))) {
    throw "dist copy failed: main.js was not copied to bundle root"
}
Write-Host "main.js confirmed at bundle root after copy."

Write-Host "Creating bundle package.json..."
$pkg = Get-Content $apiPkg -Raw | ConvertFrom-Json
$deployPkg = @{
    name = $pkg.name
    version = $pkg.version
    main = $pkg.main
    dependencies = $pkg.dependencies
    scripts = @{ start = "node main" }
}
$deployPkgJson = $deployPkg | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText("$apiBundle/package.json", $deployPkgJson)

Write-Host "Creating bundle .npmrc with hoisting..."
$bundleNpmrc = "$apiBundle/.npmrc"
$npmrcContent = "shamefully-hoist=true`n"
[System.IO.File]::WriteAllText($bundleNpmrc, $npmrcContent)

Write-Host "Installing production dependencies in bundle..."
Push-Location $apiBundle
try {
    pnpm install --prod --ignore-scripts 2>&1 | ForEach-Object { Write-Host "pnpm: $_" }
    if ($LASTEXITCODE -ne 0) { throw "pnpm install --prod failed in bundle" }

    Write-Host "`n=== DIAGNOSTIC: Bundle after pnpm install:"
    Get-ChildItem $apiBundle -Depth 2 | Select-Object -ExpandProperty FullName | Select-Object -First 30 | ForEach-Object { Write-Host "  $_" }

    Write-Host "Verifying no broken symlinks..."
    $brokenLinks = Get-ChildItem -Path "$apiBundle/node_modules" -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.Attributes -match "ReparsePoint" -and !(Test-Path $_.FullName) }
    if ($brokenLinks) {
        Write-Host "WARNING: Found $($brokenLinks.Count) broken symlinks:"
        $brokenLinks | Select-Object -First 5 | ForEach-Object { Write-Host "  $($_.FullName)" }
        throw "Bundle contains broken symlinks"
    } else {
        Write-Host "No broken symlinks found - bundle is clean"
    }

    Write-Host "`n=== DIAGNOSTIC: Hard-checking critical files after pnpm install ==="
    $checks = @(
        "$apiBundle/main.js",
        "$apiBundle/app.module.js",
        "$apiBundle/modules",
        "$apiBundle/node_modules/@nestjs/core",
        "$apiBundle/node_modules/better-sqlite3",
        "$apiBundle/package.json"
    )
    foreach ($check in $checks) {
        if (Test-Path $check) {
            Write-Host "EXISTS: $check"
        } else {
            throw "MISSING after pnpm install: $check"
        }
    }
    Write-Host "All critical bundle files verified after pnpm install."

    Write-Host "`nBundle structure (first 2 levels):"
    Get-ChildItem $apiBundle -Depth 2 | ForEach-Object { Write-Host "  $($_.Name)" }

} finally {
    Pop-Location
}

Write-Host "API production bundle created: PASS"
