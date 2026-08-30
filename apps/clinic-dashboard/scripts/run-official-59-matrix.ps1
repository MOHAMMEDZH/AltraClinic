# CI Remediation 3F — official 59-file focused matrix (retries=0, supervisor)
param(
  [string]$EvidenceDir = 'C:\Users\mrame\Downloads\pr1-ci-remediation-3f-evidence\04_focused_outcomes',
  [string]$SpecList = '',
  [int]$Retries = 0,
  [int]$StartIndex = 0
)

$ErrorActionPreference = 'Continue'
$runner = 'C:\Users\mrame\Projects\AltraClinic\apps\clinic-dashboard\scripts\run-focused-spec.ps1'
$listPath = if ($SpecList) { $SpecList } else { Join-Path $EvidenceDir 'OFFICIAL_59_SPECS.txt' }
$specs = Get-Content -LiteralPath $listPath | Where-Object { $_ -and $_.Trim() } | ForEach-Object {
  ($_ -replace '^e2e/', '').Trim()
}

New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
$progress = Join-Path $EvidenceDir 'MATRIX_PROGRESS.txt'
$failList = Join-Path $EvidenceDir 'MATRIX_FAILURES.tsv'
if (-not (Test-Path $failList)) {
  "spec`texit`tutc" | Set-Content $failList -Encoding utf8
}

function Get-TimeWaitCount {
  return @(netstat -ano | Select-String 'TIME_WAIT').Count
}

function Wait-SocketPressure {
  param(
    [int]$MaxTimeWait = 350,
    [int]$MaxWaitSeconds = 180
  )
  $deadline = (Get-Date).AddSeconds($MaxWaitSeconds)
  $tw = Get-TimeWaitCount
  while ($tw -gt $MaxTimeWait -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 5
    $tw = Get-TimeWaitCount
  }
  return $tw
}

function Clear-E2EPorts {
  foreach ($p in 3000,5173,5174,5175,5176,5177,5178,5179,5180,5181,5182,5183) {
    Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
      ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
  }
  # Orphan Chromium/Playwright browsers hold ephemeral sockets (ERR_NO_BUFFER_SPACE under long matrices).
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -match '^(chrome|chromium|msedge)\.exe$' -and
      $_.CommandLine -match 'playwright|headless|remote-debugging-port|--user-data-dir=.*playwright'
    } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
  # Wait until primary E2E ports are free (avoid overlapping API/web authority).
  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $deadline) {
    $busy = @(Get-NetTCPConnection -LocalPort 3000,5173 -State Listen -ErrorAction SilentlyContinue)
    if ($busy.Count -eq 0) { break }
    Start-Sleep -Seconds 1
  }
}

$total = $specs.Count
for ($i = $StartIndex; $i -lt $total; $i++) {
  $spec = $specs[$i]
  $n = $i + 1
  $utc = (Get-Date).ToUniversalTime().ToString('o')
  "START $n/$total $spec $utc" | Tee-Object -FilePath $progress -Append
  Clear-E2EPorts
  # Longer cool-down: Windows ephemeral port recycle + TIME_WAIT after focused webServer teardown.
  Start-Sleep -Seconds 8
  $tw = Wait-SocketPressure
  if ($tw -gt 350) { Start-Sleep -Seconds 10 }
  "PREFLIGHT $n/$total ports_free tw=$tw redis_url_unset=$([string]::IsNullOrEmpty($env:REDIS_URL)) $(Get-Date -Format o)" |
    Tee-Object -FilePath $progress -Append
  & $runner -SpecFile $spec -EvidenceDir $EvidenceDir -CandidateRoot 'WORKTREE' -Retries $Retries
  $code = $LASTEXITCODE
  "END $n/$total $spec EXIT=$code $(Get-Date -Format o)" | Tee-Object -FilePath $progress -Append
  if ($code -ne 0) {
    "$spec`t$code`t$((Get-Date).ToUniversalTime().ToString('o'))" | Add-Content $failList
  }
  Clear-E2EPorts
  $postTw = Wait-SocketPressure -MaxWaitSeconds 60
  "POSTCOOLDOWN $n/$total tw=$postTw $(Get-Date -Format o)" | Tee-Object -FilePath $progress -Append
  # Cool-down between focused boots (API+Vite webServer) to avoid blank-SPA / port races.
  Start-Sleep -Seconds 6
}

$failed = @(Get-Content $failList | Select-Object -Skip 1 | Where-Object { $_ })
"MATRIX_COMPLETE total=$total failures=$($failed.Count) $(Get-Date -Format o)" | Tee-Object -FilePath $progress -Append
exit $(if ($failed.Count -gt 0) { 1 } else { 0 })
