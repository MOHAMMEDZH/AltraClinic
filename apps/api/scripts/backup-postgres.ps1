# Requires pg_dump in PATH and DATABASE_URL set
param(
  [string]$BackupDir = (Join-Path $PSScriptRoot "..\backups\postgres"),
  [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"
if (-not $env:DATABASE_URL) { throw "DATABASE_URL is required" }

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$outFile = Join-Path $BackupDir "booking-system-$timestamp.sql.gz"

Write-Host "[backup] Writing $outFile"
& pg_dump $env:DATABASE_URL --no-owner --format=plain | gzip -9 > $outFile

$hash = Get-FileHash -Algorithm SHA256 $outFile
"$($hash.Hash)  $(Split-Path $outFile -Leaf)" | Out-File -Encoding ascii "$outFile.sha256"
Write-Host "[backup] Checksum written"

Get-ChildItem $BackupDir -Filter "booking-system-*.sql.gz" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
  Remove-Item -Force

Write-Host "[backup] Complete"
