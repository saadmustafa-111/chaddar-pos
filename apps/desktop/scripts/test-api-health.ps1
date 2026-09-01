param([string]$ExePath, [string]$ApiPath, [int]$Port=4555)
$apiMain = "$ApiPath\main.js"
$dbPath = "$env:TEMP\steelcoil_test.db"
$attachPath = "$env:TEMP\steelcoil_test_attachments"

$env:ELECTRON_RUN_AS_NODE = "1"
$env:NODE_ENV = "production"
$env:PORT = [string]$Port
$env:DATABASE_PATH = $dbPath
$env:ATTACHMENTS_DIR = $attachPath
$env:UPLOADS_BASE_URL = "http://127.0.0.1:$Port/uploads"
$env:SESSION_SECRET = "test-secret"
$env:DESKTOP_MODE = "true"
$env:ALLOWED_ORIGIN = "*"
$env:INITIAL_ADMIN_PASSWORD = "TestPass123!"

if (!(Test-Path $attachPath)) { New-Item -ItemType Directory -Path $attachPath -Force | Out-Null }

Write-Host "Starting API: $ExePath $apiMain"
Write-Host "PORT=$env:PORT DATABASE_PATH=$dbPath"

$proc = Start-Process -FilePath $ExePath -ArgumentList $apiMain -EnvironmentVariables $env -PassThru -NoNewWindow -RedirectStandardOutput "$env:TEMP\api_stdout.log" -RedirectStandardError "$env:TEMP\api_stderr.log"

$healthOk = $false
$maxWait = 30000
$interval = 500
$elapsed = 0

while ($elapsed -lt $maxWait) {
  Start-Sleep -Milliseconds $interval
  $elapsed += $interval

  if ($proc.HasExited) {
    $exitCode = $proc.ExitCode
    $stderr = Get-Content "$env:TEMP\api_stderr.log" -Raw -ErrorAction SilentlyContinue
    $stdout = Get-Content "$env:TEMP\api_stdout.log" -Raw -ErrorAction SilentlyContinue
    Stop-Process $proc.Id -Force -ErrorAction SilentlyContinue
    throw "API process exited prematurely. Exit code: $exitCode. Stdout: $stdout. Stderr: $stderr"
  }

  try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/v1/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($resp.StatusCode -eq 200) {
      $healthOk = $true
      Write-Host "Health endpoint responded: $($resp.StatusCode)"
      break
    }
  } catch {
    Write-Host "Health check attempt $([math]::Round($elapsed / 1000, 1))s - still waiting..."
  }
}

$stderr = Get-Content "$env:TEMP\api_stderr.log" -Raw -ErrorAction SilentlyContinue
$stdout = Get-Content "$env:TEMP\api_stdout.log" -Raw -ErrorAction SilentlyContinue

if (!$healthOk) {
  Stop-Process $proc.Id -Force -ErrorAction SilentlyContinue
  Write-Host "API Stdout: $stdout"
  Write-Host "API Stderr: $stderr"
  throw "API health endpoint did not respond within ${maxWait}ms. Stdout: $stdout. Stderr: $stderr"
}

Stop-Process $proc.Id -Force -ErrorAction SilentlyContinue
Remove-Item $dbPath -ErrorAction SilentlyContinue
Remove-Item $attachPath -Recurse -ErrorAction SilentlyContinue
Write-Host "API bootstrap and health endpoint test: PASS"
