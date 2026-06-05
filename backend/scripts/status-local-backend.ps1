# Show local backend status based on state.json and /health
Set-Location $PSScriptRoot
. "$PSScriptRoot\_local-backend-common.ps1"

$state = Read-State
if (-not $state) {
  Write-Host "alive     : false"
  Write-Host "reason    : no state.json (not started by start-local-backend or already stopped)"
  Write-Host "stateFile : $($script:StateFile)"
  exit 0
}

$procId = [int]$state.pid
$port = [int]$state.port
$alive = $false
try {
  $null = Get-Process -Id $procId -ErrorAction Stop
  $alive = $true
} catch {
  $alive = $false
}

$healthy = Test-Health -Port $port

Write-Host "alive       : $alive"
Write-Host "pid         : $procId"
Write-Host "port        : $port"
Write-Host "health      : $healthy"
Write-Host "healthUrl   : http://127.0.0.1:$port/health"
Write-Host "stateFile   : $($script:StateFile)"
Write-Host "logOut      : $($script:LogOut)"
Write-Host "logErr      : $($script:LogErr)"
$sa = $state.startedAt
Write-Host "startedAt   : $sa"

if (-not $alive) {
  exit 1
}
if (-not $healthy) {
  exit 2
}
exit 0

