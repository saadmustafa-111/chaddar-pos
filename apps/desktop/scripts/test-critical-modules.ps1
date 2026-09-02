param([string]$ExePath, [string]$ApiPath, [int]$Port=4444)

$env:ELECTRON_RUN_AS_NODE = "1"
$env:NODE_ENV = "production"
$env:PORT = [string]$Port

Write-Host "=== DIAGNOSTIC: Executable and Path Info ==="
Write-Host "ExePath: $ExePath"
Write-Host "ApiPath: $ApiPath"
Write-Host "Current directory: $((Get-Location).Path)"
Write-Host "GITHUB_WORKSPACE: $env:GITHUB_WORKSPACE"

$mainJs = Join-Path $ApiPath "main.js"
if (!(Test-Path $mainJs)) { throw "Missing main.js at: $mainJs" }
Write-Host "main.js verified: $mainJs"

$exeFile = Get-Item $ExePath -ErrorAction SilentlyContinue
if (!$exeFile) { throw "Executable not found: $ExePath" }
Write-Host "Executable: $($exeFile.FullName) ($($exeFile.Length) bytes)"

Write-Host "`n=== STEP 0: Electron Node smoke test ==="
$smokeCode = @"
process.chdir('$apiDirUnix');
console.log('ELECTRON_NODE_OK');
console.log('process.version:', process.version);
console.log('process.versions.electron:', process.versions.electron);
console.log('process.versions.node:', process.versions.node);
console.log('process.execPath:', process.execPath);
console.log('process.cwd():', process.cwd());
console.log('__dirname:', __dirname);
process.exit(0);
"@

$smokeFile = [System.IO.Path]::GetTempFileName() + ".js"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($smokeFile, $smokeCode, $utf8NoBom)

$smokeOutput = & $ExePath $smokeFile 2>&1
$smokeExit = $LASTEXITCODE

Write-Host "Smoke exit code: $smokeExit"
Write-Host "Smoke output:"
Write-Host $smokeOutput

Remove-Item $smokeFile -Force -ErrorAction SilentlyContinue

if ($smokeExit -ne 0 -or $smokeOutput -notmatch "ELECTRON_NODE_OK") {
    throw "Electron Node smoke test FAILED. Exit: $smokeExit. Output: $smokeOutput"
}
Write-Host "Electron Node smoke test: PASS"

$modules = @(
  "@nestjs/core",
  "@nestjs/common",
  "@nestjs/platform-express",
  "typeorm",
  "better-sqlite3",
  "bcryptjs",
  "reflect-metadata",
  "express-session"
)

$apiDirUnix = $ApiPath -replace '\\', '/'

foreach ($mod in $modules) {
  Write-Host "`n=== Testing: $mod ==="

  $testCode = @"
process.chdir('$apiDirUnix');
const { createRequire } = require('module');
const apiRequire = createRequire('$apiDirUnix/main.js');
try {
  const resolved = apiRequire.resolve('$mod');
  console.log('RESOLVED: $mod -> ' + resolved);
} catch(e) {
  console.error('RESOLVE_FAILED: $mod');
  console.error('Error: ' + e.message);
  console.error('Code: ' + e.code);
  process.exit(1);
}
try {
  const m = apiRequire('$mod');
  console.log('REQUIRED: $mod - OK');
} catch(e) {
  console.error('REQUIRE_FAILED: $mod');
  console.error('Error: ' + e.message);
  console.error('Stack: ' + e.stack);
  process.exit(1);
}
"@

  $tempFile = [System.IO.Path]::GetTempFileName() + ".js"
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($tempFile, $testCode, $utf8NoBom)

  $output = & $ExePath $tempFile 2>&1
  $exitCode = $LASTEXITCODE

  Write-Host "Exit code: $exitCode"
  Write-Host "Output:"
  Write-Host $output

  Remove-Item $tempFile -Force -ErrorAction SilentlyContinue

  if ($exitCode -ne 0 -or ($output -match "FAILED")) {
    throw "FAILED: $mod in packaged context. Exit: $exitCode. Output: $output"
  }

  Write-Host "RESULT: $mod - PASS"
}

Write-Host "`nAll critical modules resolvable in packaged context: PASS"
