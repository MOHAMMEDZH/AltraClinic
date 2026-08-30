param(
  [Parameter(Mandatory = $true)][string]$Command,
  [Parameter(Mandatory = $true)][string]$WorkingDirectory,
  [Parameter(Mandatory = $true)][string]$StdoutPath,
  [Parameter(Mandatory = $true)][string]$MetaPath,
  [string]$StderrPath = '',
  [string]$HeartbeatPath = ''
)

$ErrorActionPreference = 'Stop'

function Write-MetaLine([string]$Path, [string]$Line) {
  Add-Content -LiteralPath $Path -Value $Line -Encoding UTF8
}

function Get-RedactedEnvKeys() {
  Get-ChildItem Env: | ForEach-Object { $_.Name } | Sort-Object
}

function Get-DiskFreeBytes([string]$Root) {
  try {
    $drive = (Resolve-Path $Root).Drive
    if ($drive) { return (Get-PSDrive -Name $drive.Name).Free }
  } catch { }
  return -1
}

$startUtc = (Get-Date).ToUniversalTime().ToString('o')
$metaDir = Split-Path -Parent $MetaPath
New-Item -ItemType Directory -Force -Path $metaDir | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $StdoutPath) | Out-Null
if ($StderrPath) { New-Item -ItemType Directory -Force -Path (Split-Path -Parent $StderrPath) | Out-Null }

Set-Content -LiteralPath $MetaPath -Encoding UTF8 -Value @(
  "START_UTC=$startUtc",
  "COMMAND=$Command",
  "CWD=$WorkingDirectory",
  "STDOUT=$StdoutPath",
  "STDERR=$StderrPath",
  "ENV_KEYS=$(Get-RedactedEnvKeys -join ',')",
  "DISK_FREE_BYTES=$(Get-DiskFreeBytes $WorkingDirectory)"
)

$psiArgs = @(
  '-NoProfile', '-Command', $Command
)
$redirect = @{
  FilePath         = 'powershell.exe'
  ArgumentList     = $psiArgs
  WorkingDirectory = $WorkingDirectory
  PassThru         = $true
  Wait             = $true
  RedirectStandardOutput = $StdoutPath
}
if ($StderrPath) {
  $redirect.RedirectStandardError = $StderrPath
}

$proc = Start-Process @redirect
$exitCode = $proc.ExitCode
$endUtc = (Get-Date).ToUniversalTime().ToString('o')
$summaryPresent = $false
if (Test-Path $StdoutPath) {
  $summaryPresent = Select-String -LiteralPath $StdoutPath -Pattern 'passed \(|^\s*\d+\s+passed' -Quiet
}

Write-MetaLine $MetaPath "CHILD_PID=$($proc.Id)"
Write-MetaLine $MetaPath "END_UTC=$endUtc"
Write-MetaLine $MetaPath "EXIT=$exitCode"
Write-MetaLine $MetaPath "REPORTER_SUMMARY_PRESENT=$summaryPresent"
if (Test-Path $StdoutPath) {
  Write-MetaLine $MetaPath "STDOUT_BYTES=$((Get-Item $StdoutPath).Length)"
}

exit $exitCode
