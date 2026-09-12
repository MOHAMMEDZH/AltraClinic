#Requires -Version 5.1
<#
.SYNOPSIS
  Phase 49 K3 thin restore drill via Docker when native pg_dump/psql/gzip are absent.

.DESCRIPTION
  Reuses the same pg_dump → gzip → sha256 → psql semantics as backup-postgres.sh /
  verify-backup.sh / restore-postgres.sh against disposable DBs in booking-system-pg-test.
  NOT a new backup engine. NOT for production hosts (use native bash scripts there).

.PARAMETER Container
  Docker container name (default booking-system-pg-test).

.PARAMETER SourceDb
  Source database to dump (default booking_test).

.PARAMETER KeepRestoreDb
  If set, skip DROP of the restore database after smoke.
#>
param(
  [string]$Container = 'booking-system-pg-test',
  [string]$SourceDb = 'booking_test',
  [string]$User = 'booking',
  [switch]$KeepRestoreDb
)

$ErrorActionPreference = 'Stop'
$apiRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$repoRoot = Resolve-Path (Join-Path $apiRoot '..\..')
Set-Location $apiRoot

$shortSha = (git -C $repoRoot rev-parse --short HEAD).Trim()
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ').ToLowerInvariant()
$restoreDb = "booking_restore_k3_$stamp"
$backupDir = Join-Path $apiRoot 'backups\postgres'
$evidenceDir = Join-Path $apiRoot ".ci-evidence\phase49-k3-$shortSha"
$containerBackup = "/tmp/booking-system-$stamp.sql.gz"
$localBackup = Join-Path $backupDir "booking-system-$stamp.sql.gz"

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null

function Invoke-Pg([string]$Database, [string]$Sql) {
  # psql writes NOTICE to stderr; do not treat as terminating under $ErrorActionPreference Stop
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $out = docker exec $Container psql -U $User -d $Database -v ON_ERROR_STOP=1 -c $Sql 2>&1
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  if ($code -ne 0) {
    throw "psql failed ($code) db=$Database sql=$Sql`n$($out -join "`n")"
  }
  return $out
}

function Write-Log([string]$Name, [string]$Content) {
  $path = Join-Path $evidenceDir $Name
  Set-Content -Encoding utf8 -Path $path -Value $Content
  return $path
}

$summary = @()
function Add-Sum([string]$Line) { $script:summary += $Line; Write-Host $Line }

Add-Sum "=== Phase 49 K3 restore drill (Path B: Docker helper) ==="
Add-Sum "tip=$shortSha container=$Container source=$SourceDb restore=$restoreDb"

# 0) Preflight
docker exec $Container pg_isready -U $User -d $SourceDb | Tee-Object -Variable preflight | Out-Null
Write-Log '00_preflight.log' ($preflight -join "`n") | Out-Null

# 1) Backup inside container — schema-only for thin tooling drill.
# Full-data restore of long-lived booking_test fails on orphan FKs (fixture debt);
# production cutover uses full backup-postgres.sh against healthy ops DBs.
Add-Sum "[backup] schema-only dump $SourceDb -> $containerBackup"
$backupLog = docker exec $Container bash -lc "pg_dump -U $User -d $SourceDb --no-owner --format=plain --schema-only | gzip -9 > $containerBackup && sha256sum $containerBackup > $containerBackup.sha256 && ls -la $containerBackup $containerBackup.sha256"
Write-Log '01_backup.log' ($backupLog -join "`n") | Out-Null
docker cp "${Container}:$containerBackup" $localBackup
docker cp "${Container}:$containerBackup.sha256" "$localBackup.sha256"
Add-Sum "[backup] copied to $localBackup"

# 2) Verify (checksum + gzip -t) inside container
Add-Sum '[verify] sha256sum -c + gzip -t'
$prev = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$verifyLog = docker exec $Container bash -lc "sha256sum -c $containerBackup.sha256 && gzip -t $containerBackup && echo VERIFY_OK" 2>&1
$ErrorActionPreference = $prev
Write-Log '02_verify.log' ($verifyLog -join "`n") | Out-Null
if (($verifyLog -join "`n") -notmatch 'VERIFY_OK') { throw 'Verify failed' }

# 3–4) Restore via in-container helper (CREATE DB + plain restore)
Add-Sum "[restore] CREATE + restore $restoreDb via phase49-k3-restore-in-container.sh"
docker cp (Join-Path $PSScriptRoot 'phase49-k3-restore-in-container.sh') "${Container}:/tmp/phase49-k3-restore-in-container.sh"
$ErrorActionPreference = 'Continue'
$restoreLog = docker exec $Container bash -lc "sed -i 's/\r$//' /tmp/phase49-k3-restore-in-container.sh; bash /tmp/phase49-k3-restore-in-container.sh $User $restoreDb $containerBackup" 2>&1
$restoreCode = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
$restoreTail = ($restoreLog | Select-Object -Last 40) -join "`n"
Write-Log '03_restore.log' ("(last 40 lines)`n$restoreTail") | Out-Null
if ($restoreCode -ne 0) { throw "Restore failed exit=$restoreCode`n$restoreTail" }

# 5) Smoke (helper already prints SMOKE_PUBLIC_TABLES; re-query for evidence)
Add-Sum '[smoke] public table count'
$ErrorActionPreference = 'Continue'
$smokeTables = docker exec $Container psql -U $User -d $restoreDb -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>&1
$ErrorActionPreference = 'Stop'
$smokeBody = "public_table_count=$($smokeTables | Out-String)`nmode=schema-only-dump`nnote=full-data restore of this fixture blocked by orphan FK rows; ops full dumps use restore-postgres.sh"
Write-Log '04_smoke.log' $smokeBody | Out-Null
$tableCount = 0
$parseTarget = (($smokeTables | Out-String) -replace '[^\d]', '').Trim()
if (-not [int]::TryParse($parseTarget, [ref]$tableCount)) { $tableCount = 0 }
if ($tableCount -le 0) { throw "Smoke failed: public_table_count raw=$smokeTables" }
Add-Sum "[smoke] public_table_count=$tableCount"

# 6) Cleanup
if (-not $KeepRestoreDb) {
  Add-Sum "[cleanup] DROP DATABASE $restoreDb"
  $cleanup = Invoke-Pg 'postgres' "DROP DATABASE IF EXISTS $restoreDb;"
  Write-Log '05_cleanup.log' ($cleanup -join "`n") | Out-Null
  docker exec $Container bash -lc "rm -f $containerBackup $containerBackup.sha256" | Out-Null
} else {
  Add-Sum '[cleanup] skipped (--KeepRestoreDb)'
}

$result = 'PASS'
Add-Sum "RESULT=$result"

@"
# Phase 49 K3 restore drill

| Field | Value |
|-------|--------|
| Tip SHA | $shortSha |
| Result | $result |
| Path | B-docker-helper |
| Source DB | $SourceDb (disposable test) |
| Restore DB | $restoreDb |
| Backup artifact | $localBackup |
| Smoke | public_table_count=$tableCount (schema-only dump; full-data blocked by fixture FK orphans) |
| Notes | Native pg_dump not on PATH; Docker helper used. Full-data restore of booking_test FAILS on commission_package_session_allocations orphan FK — documented; cutover path remains full backup-postgres.sh + restore-postgres.sh on healthy DBs. |

Do not commit this evidence directory or backup dumps.
"@ | Set-Content -Encoding utf8 (Join-Path $evidenceDir '00_SUMMARY.md')

Add-Sum "evidence=$evidenceDir"
exit 0
