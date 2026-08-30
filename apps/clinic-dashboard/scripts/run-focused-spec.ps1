param(
  [string]$SpecFile,
  [string]$EvidenceDir = 'C:\Users\mrame\Downloads\pr1-ci-remediation-3f-evidence\04_focused_outcomes',
  [string]$CandidateRoot = '',
  [int]$Retries = 0
)

$ErrorActionPreference = 'Stop'
if (-not $CandidateRoot) {
  $CandidateRoot = (Get-Content "$env:TEMP\ci3f_candidate_root.txt" -ErrorAction SilentlyContinue).Trim()
}
if (-not $CandidateRoot) {
  $CandidateRoot = (Get-Content "$env:TEMP\ci3e_final_candidate_root.txt" -ErrorAction SilentlyContinue).Trim()
}
$dash = 'C:\Users\mrame\Projects\AltraClinic\apps\clinic-dashboard'
if ($CandidateRoot -and $CandidateRoot -ne 'WORKTREE') {
  $dash = Join-Path $CandidateRoot 'candidate\apps\clinic-dashboard'
}

New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
$safe = ($SpecFile -replace '[\\/:*?"<>|]', '_')
$stdout = Join-Path $EvidenceDir "raw_${safe}.txt"
$meta = Join-Path $EvidenceDir "meta_${safe}.txt"
$sup = Join-Path (Split-Path $dash) '..\clinic-dashboard\scripts\e2e-run-supervisor.ps1'
if (-not (Test-Path $sup)) { $sup = 'C:\Users\mrame\Projects\AltraClinic\apps\clinic-dashboard\scripts\e2e-run-supervisor.ps1' }

Remove-Item Env:REDIS_URL -ErrorAction SilentlyContinue
Remove-Item Env:PLAYWRIGHT_REDIS_URL -ErrorAction SilentlyContinue
$env:CI = 'true'
$env:REDIS_OPTIONAL = 'true'
# Playwright pins unreachable REDIS_URL for the API child (CI parity). Do not set PLAYWRIGHT_REDIS_URL here.
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/saas_emr?schema=public'
$env:JWT_ACCESS_SECRET = 'ci-access-secret-minimum-32-characters-long'
$env:JWT_REFRESH_SECRET = 'ci-refresh-secret-minimum-32-characters-long'
$env:JWT_ACCESS_EXPIRES = '900'
$env:JWT_REFRESH_EXPIRES = '604800'
$env:NODE_ENV = 'test'
$env:PLAYWRIGHT_API_URL = 'http://127.0.0.1:3000'
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:5173'

$apiDir = Join-Path (Split-Path $dash -Parent) 'api'
$seedLog = Join-Path $EvidenceDir 'prisma-seed.log'
"SEED_START $(Get-Date -Format o)" | Add-Content $seedLog
Push-Location $apiDir
try {
  # prisma/npm may write box-drawing UI to stderr; under Stop that becomes a
  # terminating NativeCommandError even when seed exit code is 0.
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  npm run db:seed 2>&1 | Tee-Object -FilePath $seedLog -Append
  $seedExit = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  if ($seedExit -ne 0) {
    throw "prisma db seed failed with exit code $seedExit"
  }
} finally {
  Pop-Location
}
"SEED_END $(Get-Date -Format o)" | Add-Content $seedLog

$cmd = "npx playwright test e2e/$SpecFile --retries=$Retries"
& $sup -Command $cmd -WorkingDirectory $dash -StdoutPath $stdout -MetaPath $meta
$exit = $LASTEXITCODE
$summary = Select-String -LiteralPath $stdout -Pattern '(\d+) passed|(\d+) failed|(\d+) skipped' | Select-Object -Last 1
"$SpecFile`t$exit`t$summary" | Add-Content (Join-Path $EvidenceDir 'ALL_SPEC_OUTCOMES.tsv')
exit $exit
