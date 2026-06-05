# Standard local backend launcher: read .env, validate DATABASE_URL,
# test DB, sync Prisma, build, start server, wait for /health, write PID.
# Usage: run from backend with .\scripts\start-local-backend.ps1
#    or: powershell -NoProfile -File backend/scripts/start-local-backend.ps1
param(
  [switch]$SkipBuild,
  [switch]$SkipDbPush
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
. "$PSScriptRoot\_local-backend-common.ps1"

$envFile = Join-Path $script:BackendRoot ".env"
Write-Host "[local-backend] backendRoot: $($script:BackendRoot)"
Write-Host "[local-backend] envFile    : $envFile"

if (-not (Test-Path -LiteralPath $envFile)) {
  Write-Error "Missing backend/.env. Copy .env.example first and set DATABASE_URL."
}

$envMap = Read-DotEnv -EnvPath $envFile
if (-not $envMap['DATABASE_URL'] -or $envMap['DATABASE_URL'].Trim() -eq '') {
  Write-Error "DATABASE_URL is empty in backend/.env."
}

$requestedPort = Get-BackendPort -EnvMap $envMap
$port = Get-AvailableBackendPort -RequestedPort $requestedPort
if ($port -ne $requestedPort) {
  Write-Host "[local-backend] targetPort : $requestedPort (occupied, use $port)"
} else {
  Write-Host "[local-backend] targetPort : $port"
}

$existing = Read-State
if ($existing) {
  $procAlive = $false
  try { $null = Get-Process -Id ([int]$existing.pid) -ErrorAction Stop; $procAlive = $true } catch {}
  if ($procAlive -and (Test-Health -Port ([int]$existing.port))) {
    Write-Host "[local-backend] alreadyRunning: PID=$($existing.pid) port=$($existing.port)"
    Write-Host "[local-backend] run .\scripts\stop-local-backend.ps1 first if restart is needed"
    exit 0
  }
  Write-Host "[local-backend] stale state detected; removing old state file"
  Remove-State
}

Write-Host "[local-backend] checkDb    : prisma db execute"
$mariaDbCmd = "`"$script:MariaDbExe`" --defaults-file=`"C:/Program Files/MariaDB 12.2/data/my.ini`" --console"
Write-Host "[local-backend] localDbCmd : $mariaDbCmd"
if (Start-LocalMariaDbIfNeeded) {
  Write-Host "[local-backend] localDb    : ready on 3306"
} else {
  Write-Host "[local-backend] localDb    : first try failed, fallback start once"
  if ((Test-Path -LiteralPath $script:MariaDbExe) -and (Test-Path -LiteralPath $script:MariaDbIni)) {
    Start-Process -FilePath $script:MariaDbExe `
      -ArgumentList @("--defaults-file=C:/Program Files/MariaDB 12.2/data/my.ini", "--console") `
      -WindowStyle Hidden | Out-Null
    Start-Sleep -Seconds 3
  }
  if (Test-PortListening -Port 3306) {
    Write-Host "[local-backend] localDb    : ready on 3306 (fallback)"
  } else {
    Write-Error "localDb start failed. Try running manually: $mariaDbCmd"
  }
}
$dbCheckFile = Join-Path $env:TEMP "smart-cto-local-dbcheck.sql"
$dbCheckOut = Join-Path $env:TEMP "smart-cto-local-dbcheck.out.log"
$dbCheckErr = Join-Path $env:TEMP "smart-cto-local-dbcheck.err.log"
$dbCheckCode = 1
try {
  Set-Content -LiteralPath $dbCheckFile -Value "SELECT 1;" -Encoding Ascii
  $dbCheckProc = Start-Process -FilePath "npx.cmd" `
    -ArgumentList @("prisma", "db", "execute", "--file", $dbCheckFile) `
    -WorkingDirectory $script:BackendRoot `
    -PassThru `
    -Wait `
    -NoNewWindow `
    -RedirectStandardOutput $dbCheckOut `
    -RedirectStandardError $dbCheckErr
  $dbCheckCode = $dbCheckProc.ExitCode
} finally {
  Remove-Item -LiteralPath $dbCheckFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $dbCheckOut -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $dbCheckErr -Force -ErrorAction SilentlyContinue
}
if ($dbCheckCode -ne 0) {
  Write-Error "Database is not reachable. Check MySQL/MariaDB and DATABASE_URL."
}

Write-Host "[local-backend] ownerCompat: node scripts/local-dev-ensure-owner-isolation.cjs"
Push-Location $script:BackendRoot
try {
  & node "scripts/local-dev-ensure-owner-isolation.cjs"
  if ($LASTEXITCODE -ne 0) { Write-Error "owner compat script failed" }
} finally {
  Pop-Location
}

if (-not $SkipDbPush) {
  Write-Host "[local-backend] prismaPush : npx prisma db push"
  $pushCode = Invoke-PrismaDbPush -BackendRootPath $script:BackendRoot
  if ($pushCode -ne 0) {
    Write-Error "prisma db push failed with exit code $pushCode"
  }
} else {
  Write-Host "[local-backend] prismaPush : skipped (-SkipDbPush)"
}

if (-not $SkipBuild) {
  Write-Host "[local-backend] build      : npm run build"
  Push-Location $script:BackendRoot
  try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { Write-Error "npm run build failed" }
  } finally {
    Pop-Location
  }
} else {
  Write-Host "[local-backend] build      : skipped (-SkipBuild)"
}

Ensure-LocalDirs
$outLog = $script:LogOut
$errLog = $script:LogErr
Write-Host "[local-backend] start      : node dist/src/server.js"
$env:PORT = "$port"
$proc = Start-Process -FilePath "node" -ArgumentList "dist/src/server.js" -WorkingDirectory $script:BackendRoot `
  -PassThru -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog

Write-State -ProcessId $proc.Id -Port $port
Write-Host "[local-backend] state      : PID=$($proc.Id) -> $($script:StateFile)"

Write-Host "[local-backend] waitHealth : /health (max 45s)"
if (-not (Wait-Health -Port $port -MaxSeconds 45)) {
  Write-Host "[local-backend] health check failed. Recent logs:"
  if (Test-Path $errLog) { Get-Content $errLog -Tail 30 -ErrorAction SilentlyContinue }
  if (Test-Path $outLog) { Get-Content $outLog -Tail 30 -ErrorAction SilentlyContinue }
  Write-Error "Service did not become healthy in time. Check the logs above."
}

$healthUrl = "http://127.0.0.1:$port/health"
Write-Host ""
Write-Host "========== START OK =========="
Write-Host "  PORT      : $port"
Write-Host "  PID       : $($proc.Id)"
Write-Host "  STATE FILE: $script:StateFile"
Write-Host "  LOG OUT   : $outLog"
Write-Host "  LOG ERR   : $errLog"
Write-Host "  Health URL: $healthUrl"
Write-Host "=============================="
Write-Host ""




