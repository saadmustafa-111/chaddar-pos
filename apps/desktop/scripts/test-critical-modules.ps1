param([string]$ExePath, [string]$ApiPath, [int]$Port=4444)
$env:ELECTRON_RUN_AS_NODE = "1"
$env:NODE_ENV = "production"
$env:PORT = [string]$Port

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

foreach ($mod in $modules) {
  $testCode = "try { require.resolve('$mod'); console.log('OK') } catch(e) { console.error('FAIL: $mod - ' + e.message); process.exit(1) }"
  $result = & $ExePath -e $testCode 2>&1
  if ($LASTEXITCODE -ne 0 -or ($result -match "FAIL")) {
    throw "FAILED to require '$mod' in packaged context. Output: $result"
  }
  Write-Host "require.resolve('$mod'): OK"
}
Write-Host "All critical modules resolvable in packaged context: PASS"
