# Chains the 6 task runs, alternating W1,W2 (fixed order, no random seed). Stops after 3 consecutive technical failures.
# Usage (PowerShell, from anywhere):  .\run-all.ps1
# Output directory: $env:EXP_RUN_DIR, default experiment\run-windows (next to the harness folder). Same variable for run-one.js.
$RunDir = if ($env:EXP_RUN_DIR) { $env:EXP_RUN_DIR } else { Join-Path $PSScriptRoot '..\..\run-windows' }
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
$RunDir = (Resolve-Path $RunDir).Path
$env:EXP_RUN_DIR = $RunDir
$Log = Join-Path $RunDir 'run-all.log'
$fails = 0
foreach ($r in 'W1-1','W2-1','W1-2','W2-2','W1-3','W2-3') {
  $c = $r.Substring(0,2)
  $line = node (Join-Path $PSScriptRoot 'run-one.js') $c $r task 2>&1 | Select-Object -Last 1
  Add-Content $Log "$(Get-Date -Format s) $line"
  $j = Get-Content (Join-Path $RunDir "runs\$r.json") -Raw | ConvertFrom-Json
  if ($j.exitCode -ne 0 -or $j.result.is_error) { $fails++ } else { $fails = 0 }
  if ($fails -ge 3) { Add-Content $Log 'STOP: 3 consecutive failures'; break }
}
Add-Content $Log "$(Get-Date -Format s) DONE"
