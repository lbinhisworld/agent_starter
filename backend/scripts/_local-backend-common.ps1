# Shared helpers for local backend scripts: paths, .env parsing, state file.
# [PROTOCOL]: Sync changes with backend/scripts/README-local.md and docs/agents/backend-agent.md

$script:BackendRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$script:LocalDir = Join-Path $script:BackendRoot ".local"
$script:RunDir = Join-Path $script:LocalDir "run"
$script:LogDir = Join-Path $script:LocalDir "logs"
$script:StateFile = Join-Path $script:RunDir "state.json"
$script:LogOut = Join-Path $script:LogDir "backend.out.log"
$script:LogErr = Join-Path $script:LogDir "backend.err.log"
$script:MariaDbExe = "C:\Program Files\MariaDB 12.2\bin\mariadbd.exe"
$script:MariaDbIni = "C:\Program Files\MariaDB 12.2\data\my.ini"

function Ensure-LocalDirs {
  New-Item -ItemType Directory -Force -Path $script:RunDir | Out-Null
  New-Item -ItemType Directory -Force -Path $script:LogDir | Out-Null
}

function Read-DotEnv {
  param([string]$EnvPath)
  $map = @{}
  if (-not (Test-Path -LiteralPath $EnvPath)) { return $map }
  foreach ($line in Get-Content -LiteralPath $EnvPath -Encoding UTF8 -ErrorAction SilentlyContinue) {
    $t = $line.Trim()
    if ($t -match '^\s*#' -or $t -eq '') { continue }
    $eq = $t.IndexOf('=')
    if ($eq -lt 1) { continue }
    $k = $t.Substring(0, $eq).Trim()
    $v = $t.Substring($eq + 1).Trim()
    if ($v.Length -ge 2 -and (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'")))) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    $map[$k] = $v
  }
  $map
}

function Get-BackendPort {
  param([hashtable]$EnvMap)
  if ($EnvMap['PORT'] -and $EnvMap['PORT'] -match '^\d+$') { return [int]$EnvMap['PORT'] }
  3000
}

function Test-PortListening {
  param([int]$Port)
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  return ($null -ne $listener)
}

function Get-AvailableBackendPort {
  param([int]$RequestedPort)
  $port = $RequestedPort
  while (Test-PortListening -Port $port) {
    $port++
  }
  return $port
}

function Test-PrismaDatabase {
  param([string]$BackendRootPath)
  Push-Location $BackendRootPath
  try {
    $null = "SELECT 1" | & npx prisma db execute --stdin 2>&1
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  } finally {
    Pop-Location
  }
}

function Start-LocalMariaDbIfNeeded {
  if (Test-PortListening -Port 3306) {
    return $true
  }
  if (-not ((Test-Path -LiteralPath $script:MariaDbExe) -and (Test-Path -LiteralPath $script:MariaDbIni))) {
    return $false
  }
  Start-Process -FilePath $script:MariaDbExe `
    -ArgumentList @("--defaults-file=C:/Program Files/MariaDB 12.2/data/my.ini", "--console") `
    -WindowStyle Hidden | Out-Null
  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    if (Test-PortListening -Port 3306) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Invoke-PrismaDbPush {
  param([string]$BackendRootPath)
  $stdoutFile = Join-Path $env:TEMP "smart-cto-prisma-push.out.log"
  $stderrFile = Join-Path $env:TEMP "smart-cto-prisma-push.err.log"
  try {
    $proc = Start-Process -FilePath "npx.cmd" `
      -ArgumentList @("prisma", "db", "push") `
      -WorkingDirectory $BackendRootPath `
      -PassThru `
      -Wait `
      -NoNewWindow `
      -RedirectStandardOutput $stdoutFile `
      -RedirectStandardError $stderrFile
    return $proc.ExitCode
  } finally {
    Remove-Item -LiteralPath $stdoutFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $stderrFile -Force -ErrorAction SilentlyContinue
  }
}

function Write-State {
  param([int]$ProcessId, [int]$Port)
  Ensure-LocalDirs
  $obj = [ordered]@{
    pid        = $ProcessId
    port       = $Port
    startedAt  = (Get-Date).ToString("o")
    scriptRoot = $script:BackendRoot
  }
  ($obj | ConvertTo-Json -Depth 3) | Set-Content -LiteralPath $script:StateFile -Encoding UTF8
}

function Read-State {
  if (-not (Test-Path -LiteralPath $script:StateFile)) { return $null }
  try {
    Get-Content -LiteralPath $script:StateFile -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    $null
  }
}

function Remove-State {
  if (Test-Path -LiteralPath $script:StateFile) {
    Remove-Item -LiteralPath $script:StateFile -Force
  }
}

function Test-Health {
  param([int]$Port)
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -UseBasicParsing -TimeoutSec 3
    return ($r.StatusCode -eq 200)
  } catch {
    return $false
  }
}

function Wait-Health {
  param([int]$Port, [int]$MaxSeconds = 45)
  $deadline = (Get-Date).AddSeconds($MaxSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Health -Port $Port) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return $false
}



