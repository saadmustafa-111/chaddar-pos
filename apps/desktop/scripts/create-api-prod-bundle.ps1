$ErrorActionPreference = 'Stop'

$apiBundle = "apps/api/prod-bundle"
$apiDist = "apps/api/dist"
$apiPkg = "apps/api/package.json"

Write-Host "Creating API production bundle at $apiBundle"

if (Test-Path $apiBundle) { Remove-Item $apiBundle -Recurse -Force }
New-Item -ItemType Directory -Path $apiBundle -Force | Out-Null

Write-Host "Copying dist/ contents into bundle root..."
Get-ChildItem -Path $apiDist | Copy-Item -Destination $apiBundle -Recurse -Force

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

    Write-Host "Verifying no broken symlinks..."
    $brokenLinks = Get-ChildItem -Path "$apiBundle/node_modules" -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.Attributes -match "ReparsePoint" -and !(Test-Path $_.FullName) }
    if ($brokenLinks) {
        Write-Host "WARNING: Found $($brokenLinks.Count) broken symlinks:"
        $brokenLinks | Select-Object -First 5 | ForEach-Object { Write-Host "  $($_.FullName)" }
        throw "Bundle contains broken symlinks"
    } else {
        Write-Host "No broken symlinks found - bundle is clean"
    }

    Write-Host "Verifying critical bundle files..."
    if (!(Test-Path "$apiBundle/main.js")) { throw "Bundle missing main.js at root" }
    if (!(Test-Path "$apiBundle/app.module.js")) { throw "Bundle missing app.module.js" }
    if (!(Test-Path "$apiBundle/modules")) { throw "Bundle missing modules directory" }
    if (!(Test-Path "$apiBundle/node_modules/@nestjs/core")) { throw "Bundle missing @nestjs/core" }
    if (!(Test-Path "$apiBundle/node_modules/better-sqlite3")) { throw "Bundle missing better-sqlite3" }
    Write-Host "Critical bundle files verified."

    Write-Host "`nBundle structure (first 3 levels):"
    Get-ChildItem $apiBundle -Depth 2 | ForEach-Object { Write-Host "  $($_.Name)" }
    Get-ChildItem "$apiBundle/node_modules" -Depth 1 | Select-Object -First 10 | ForEach-Object { Write-Host "  node_modules/$($_.Name)" }

} finally {
    Pop-Location
}

Write-Host "API production bundle created: PASS"
