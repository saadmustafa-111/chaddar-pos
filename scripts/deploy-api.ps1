param(
    [string]$SourceApiPath = "apps/api",
    [string]$DeployPath = "apps/api/deploy",
    [string]$StagingPath = "$env:TEMP\steelchaddar-api-staging"
)

$ErrorActionPreference = 'Stop'

$repoPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$SourceApiPath = [IO.Path]::GetFullPath((Join-Path $repoPath $SourceApiPath))
$DeployPath = [IO.Path]::GetFullPath((Join-Path $repoPath $DeployPath))
$StagingPath = [IO.Path]::GetFullPath($StagingPath)
# Validate cleanup targets before any recursive removal.
if ($DeployPath -ne (Join-Path $SourceApiPath 'deploy')) {
    throw 'DeployPath must be the deploy directory inside SourceApiPath.'
}
if (-not $SourceApiPath.StartsWith($repoPath + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'SourceApiPath must be inside the repository.'
}
$tempRoot = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
if (-not $StagingPath.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or
    [IO.Path]::GetFileName($StagingPath) -ne 'steelchaddar-api-staging') {
    throw 'StagingPath must be a steelchaddar-api-staging directory inside TEMP.'
}

function Get-ExternalLinks {
    param([string]$Path, [string]$BasePath)
    $links = @()
    Get-ChildItem -LiteralPath $Path -Recurse -Depth 5 -ErrorAction SilentlyContinue |
        Where-Object { $_.LinkType -in @('SymbolicLink', 'Junction') } |
        ForEach-Object {
            $target = $_.Target
            if ($target -is [System.Object[]]) { $target = $target[0] }
            $escapedBase = [regex]::Escape($BasePath)
            if ($target -notmatch $escapedBase) {
                $links += [PSCustomObject]@{
                    Path = $_.FullName
                    Target = $target
                }
            }
        }
    return $links
}

Write-Host "=== SteelChaddar API Production Deployment Script ==="
Write-Host "Source: $SourceApiPath"
Write-Host "Deploy: $DeployPath"
Write-Host "Staging: $StagingPath"

if (Test-Path -LiteralPath $StagingPath) {
    Write-Host "Cleaning staging folder..."
    Remove-Item -LiteralPath $StagingPath -Recurse -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Path $StagingPath -Force | Out-Null
New-Item -ItemType Directory -Path $DeployPath -Force | Out-Null

Write-Host "Reading source package.json..."
$sourcePackageJson = Get-Content "$SourceApiPath\package.json" | ConvertFrom-Json
# Pin SQLite to the API importer's resolution, not the semver range in package.json.
$lockText = Get-Content (Join-Path $repoPath 'pnpm-lock.yaml') -Raw
$apiImporter = [regex]::Match($lockText, '(?ms)^  apps/api:\r?\n(?<body>.*?)(?=^  \S|\z)')
$sqliteResolution = [regex]::Match($apiImporter.Groups['body'].Value, '(?m)^      better-sqlite3:\r?\n        specifier: [^\r\n]+\r?\n        version: (?<version>\d+\.\d+\.\d+)\r?$')
if (-not $sqliteResolution.Success) { throw 'Cannot resolve better-sqlite3 from the API lockfile importer.' }
$sqliteVersion = $sqliteResolution.Groups['version'].Value
$sourcePackageJson.dependencies.'better-sqlite3' = $sqliteVersion
Write-Host "Locked better-sqlite3 version: $sqliteVersion"

$prodPackageJson = [PSCustomObject]@{
    name = $sourcePackageJson.name
    version = $sourcePackageJson.version
    description = $sourcePackageJson.description
    author = $sourcePackageJson.author
    private = $sourcePackageJson.private
    license = $sourcePackageJson.license
    scripts = @{
        build = "echo 'Already built'"
        start = "node dist/main"
    }
    dependencies = $sourcePackageJson.dependencies
}

Write-Host "Writing production package.json to staging..."
$prodPackageJson | ConvertTo-Json -Depth 10 | Set-Content "$StagingPath\package.json"

Write-Host "Installing production dependencies using npm (creates actual copies, not junctions)..."
Push-Location $StagingPath
try {
    # Windows PowerShell treats native stderr warnings as errors under Stop.
    $ErrorActionPreference = 'Continue'
    npm install --omit=dev --ignore-scripts --legacy-peer-deps 2>&1 | ForEach-Object { Write-Host "  $_" }
    $installExitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($installExitCode -ne 0) {
        throw "npm install failed with exit code $installExitCode"
    }
} finally {
    $ErrorActionPreference = 'Stop'
    Pop-Location
}

Write-Host "Copying dist folder..."
$stagedSqlite = Get-Content "$StagingPath\node_modules\better-sqlite3\package.json" | ConvertFrom-Json
if ($stagedSqlite.version -ne $sqliteVersion) { throw 'Staged better-sqlite3 does not match the API lockfile.' }
$sourceDist = "$SourceApiPath\dist"
if (-not (Test-Path -LiteralPath $sourceDist)) {
    throw "Source dist folder not found: $sourceDist"
}
Copy-Item -LiteralPath $sourceDist -Destination "$StagingPath\dist" -Recurse -Force

$stagingBaseEscaped = [regex]::Escape($StagingPath)

Write-Host "Checking for external junctions in staging..."
$externalLinks = Get-ExternalLinks -Path $StagingPath -BasePath $StagingPath
if ($externalLinks.Count -gt 0) {
    Write-Host "WARNING: Found $($externalLinks.Count) external junctions in staging:"
    $externalLinks | ForEach-Object { Write-Host "  $($_.Path) -> $($_.Target)" }
}

Write-Host "Cleaning deploy folder..."
Get-ChildItem -LiteralPath $DeployPath -Force | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Recurse -Force
}

Write-Host "Copying staging to deploy (materializing any junctions)..."
Get-ChildItem -LiteralPath $StagingPath -ErrorAction SilentlyContinue | ForEach-Object {
    $item = $_
    $dest = Join-Path $DeployPath $item.Name
    if ($item.LinkType -and $item.Target) {
        $target = $item.Target
        if ($target -is [System.Object[]]) { $target = $target[0] }
        if (Test-Path -LiteralPath $target -PathType Container) {
            Write-Host "  Materializing linked dir: $($item.Name) -> $target"
            Copy-Item -LiteralPath $target -Destination $dest -Recurse -Force
        } elseif (Test-Path -LiteralPath $target -PathType Leaf) {
            Write-Host "  Materializing linked file: $($item.Name) -> $target"
            Copy-Item -LiteralPath $target -Destination $dest -Force
        } else {
            Copy-Item -LiteralPath $item.FullName -Destination $dest -Recurse -Force
        }
    } else {
        Copy-Item -LiteralPath $item.FullName -Destination $dest -Recurse -Force
    }
}

Write-Host "Checking for remaining external junctions in deploy..."
$deployLinks = Get-ExternalLinks -Path $DeployPath -BasePath $DeployPath
if ($deployLinks.Count -gt 0) {
    Write-Host "ERROR: Found $($deployLinks.Count) external junctions in deploy:"
    $deployLinks | ForEach-Object { Write-Host "  $($_.Path) -> $($_.Target)" }
    throw "Deploy folder contains external junctions - not self-contained!"
}

Write-Host "Verifying critical files exist..."
$criticalFiles = @(
    "$DeployPath\dist\main.js",
    "$DeployPath\node_modules\@nestjs\core",
    "$DeployPath\node_modules\better-sqlite3"
)
foreach ($file in $criticalFiles) {
    if (Test-Path -LiteralPath $file) {
        Write-Host "  OK: $file"
    } else {
        throw "MISSING: $file"
    }
}

Write-Host "Cleaning staging..."
Remove-Item -LiteralPath $StagingPath -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "=== Deployment complete ==="

Write-Host ""
Write-Host "NOTE: If the deployed app uses Electron's Node runtime (ELECTRON_RUN_AS_NODE),"
Write-Host "native modules may need to be rebuilt for Electron ABI compatibility."
Write-Host "The desktop afterPack hook rebuilds better-sqlite3 for Electron and tests API health."
