# Stop the backend process recorded by start-local-backend.ps1 in state.json
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
. "$PSScriptRoot\_local-backend-common.ps1"

$state = Read-State
if (-not $state) {
  Write-Host "[local-backend] no state file: $($script:StateFile)"
  exit 0
}

$procId = [int]$state.pid
$port = [int]$state.port
Write-Host "[local-backend] stopping PID=$procId (port=$port, source=state.json)"

try {
  $p = Get-Process -Id $procId -ErrorAction Stop
  Stop-Process -Id $procId -Force
  Write-Host "[local-backend] stop signal sent to $($p.ProcessName)"
} catch {
  Write-Host "[local-backend] process already gone or cannot be stopped: $_"
}

Remove-State
Write-Host "[local-backend] state file removed"
Write-Host "[local-backend] done"

