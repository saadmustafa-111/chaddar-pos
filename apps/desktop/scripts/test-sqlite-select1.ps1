param([string]$ExePath, [string]$ApiPath)

$env:ELECTRON_RUN_AS_NODE = "1"
$env:NODE_ENV = "production"

$mainJs = Join-Path $ApiPath "main.js"
if (!(Test-Path $mainJs)) { throw "Missing main.js at: $mainJs" }
Write-Host "main.js verified: $mainJs"

$exeFile = Get-Item $ExePath -ErrorAction SilentlyContinue
if (!$exeFile) { throw "Executable not found: $ExePath" }
Write-Host "Executable: $($exeFile.FullName) ($($exeFile.Length) bytes)"

$apiDir = $ApiPath
$apiDirUnix = $apiDir -replace '\\', '/'

Write-Host "`n=== Electron Node smoke test ==="
$smokeCode = @"
process.chdir('$apiDirUnix');
console.log('ELECTRON_NODE_OK');
console.log('cwd:', process.cwd());
process.exit(0);
"@

$smokeFile = [System.IO.Path]::GetTempFileName() + ".js"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($smokeFile, $smokeCode, $utf8NoBom)

$smokeOutput = & $ExePath $smokeFile 2>&1
$smokeExit = $LASTEXITCODE
Write-Host "Smoke exit: $smokeExit"
Write-Host "Smoke output:"
Write-Host $smokeOutput
Remove-Item $smokeFile -Force -ErrorAction SilentlyContinue
if ($smokeExit -ne 0 -or $smokeOutput -notmatch "ELECTRON_NODE_OK") {
    throw "Electron smoke test FAILED. Exit: $smokeExit. Output: $smokeOutput"
}
Write-Host "Electron Node smoke: PASS"

Write-Host "`n=== Testing: better-sqlite3 SQLite SELECT 1 ==="

$testCode = @"
process.chdir('$apiDirUnix');
const { createRequire } = require('module');
const apiRequire = createRequire('$apiDirUnix/main.js');

try {
  const Database = apiRequire('better-sqlite3');
  console.log('better-sqlite3 loaded: OK');
  const db = new Database(':memory:');
  console.log('Database opened: OK');
  const result = db.prepare('SELECT 1 as value').get();
  console.log('Query executed: OK');
  db.close();
  console.log('Database closed: OK');
  if (result.value === 1) {
    console.log('SQLite SELECT 1: PASS');
  } else {
    console.error('SQLite SELECT 1: unexpected result', result);
    process.exit(1);
  }
} catch(e) {
  console.error('SQLite test FAILED');
  console.error('Error: ' + e.message);
  console.error('Stack: ' + e.stack);
  console.error('Code: ' + e.code);
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

if ($exitCode -ne 0) {
  throw "better-sqlite3 SQLite test FAILED. Exit code: $exitCode. Output: $output"
}
if ($output -match "FAILED") {
  throw "better-sqlite3 SQLite test reported failure: $output"
}

Write-Host "better-sqlite3 SQLite SELECT 1: PASS"
