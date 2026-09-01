param([string]$ExePath, [string]$ApiPath)
$env:ELECTRON_RUN_AS_NODE = "1"
$env:NODE_ENV = "production"

$apiDir = $ApiPath -replace '\\', '/'
$testCode = @"
process.chdir('$apiDir');
try {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  const result = db.prepare('SELECT 1 as value').get();
  db.close();
  if (result.value === 1) {
    console.log('SQLite SELECT 1: OK');
  } else {
    console.error('SQLite SELECT 1: unexpected result', result);
    process.exit(1);
  }
} catch(e) {
  console.error('SQLite test FAILED:', e.message);
  process.exit(1);
}
"@

$result = & $ExePath -e $testCode 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "better-sqlite3 SQLite test FAILED. Exit code: $LASTEXITCODE. Output: $result"
}
if ($result -match "FAILED") {
  throw "better-sqlite3 SQLite test reported failure: $result"
}
Write-Host "better-sqlite3 SQLite SELECT 1: PASS"
