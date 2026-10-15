<#
  setup-service.ps1 - register the GluMira local proxy as a Windows service (GlumiraProxy).

  Run once: right-click this file -> Run with PowerShell, then say Yes to the administrator prompt
  (it elevates itself). Or from an admin PowerShell:  powershell -ExecutionPolicy Bypass -File .\setup-service.ps1
  Dry run (changes nothing, no admin needed):  .\setup-service.ps1 -WhatIf

  What it does: finds node, installs NSSM with winget if it is missing, installs Express once,
  registers server.js from this folder as an auto-start service with logs next to it, starts it,
  then prints the service status, the log tail and /health.
  Re-running it updates the existing service in place. Code updates need no admin: with
  PROXY_SELF_RELOAD=1 the proxy exits when server.js changes (for example after a git pull) and NSSM
  starts it again on the new code. A crash exits the same way, so NSSM restarts that too.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$ServiceName = 'GlumiraProxy',
  [int]$Port = 3001
)

$ErrorActionPreference = 'Stop'
$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Server = Join-Path $Dir 'server.js'
$OutLog = Join-Path $Dir 'proxy.log'
$ErrLog = Join-Path $Dir 'proxy.err.log'
$DryRun = [bool]$WhatIfPreference

function Say($msg) { Write-Host "[GlumiraProxy] $msg" }
function Pause-IfWindow { if (-not $DryRun -and $Host.Name -eq 'ConsoleHost') { Read-Host 'Press Enter to close' | Out-Null } }
trap { Write-Host "[GlumiraProxy] FAILED: $($_.Exception.Message)" -ForegroundColor Red; Pause-IfWindow; exit 1 }

if (-not (Test-Path $Server)) { throw "server.js not found next to this script: $Server" }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin -and -not $DryRun) {
  # Started with "Run with PowerShell": ask Windows for admin once and run again elevated.
  Say 'Asking Windows for administrator rights...'
  Start-Process powershell.exe -Verb RunAs -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$($MyInvocation.MyCommand.Path)`"",
    '-ServiceName', $ServiceName, '-Port', $Port)
  exit 0
}

# 1. node
$node = (& where.exe node 2>$null | Select-Object -First 1)
if (-not $node) { throw 'node.exe not found on PATH. Install Node.js LTS first (winget install OpenJS.NodeJS.LTS).' }
Say "node: $node"

# 2. nssm
function Find-Nssm {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  $c = Get-Command nssm.exe -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  foreach ($links in @((Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\nssm.exe'), "$env:ProgramFiles\WinGet\Links\nssm.exe")) {
    if (Test-Path $links) { return $links }
  }
  $pkg = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'), "$env:ProgramFiles\WinGet\Packages" `
    -Filter nssm.exe -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match 'win64' } | Select-Object -First 1
  if ($pkg) { return $pkg.FullName }
  return $null
}
$nssm = Find-Nssm
if (-not $nssm) {
  if ($PSCmdlet.ShouldProcess('NSSM', 'winget install NSSM.NSSM --source winget')) {
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) { throw 'winget is not available. Install "App Installer" from the Microsoft Store, then run this again.' }
    # --source winget: only the winget community source. Without it a failing Microsoft Store
    # source (seen 2026-10-06: msstore DNS error 0x80072ee7) makes winget refuse to pick and install nothing.
    & winget install --id NSSM.NSSM --exact --source winget --accept-source-agreements --accept-package-agreements
    $wingetExit = $LASTEXITCODE
    $nssm = Find-Nssm
    if (-not $nssm) { throw "winget could not install NSSM (exit $wingetExit). Check the internet connection and run this again." }
  } else {
    $nssm = 'nssm.exe'
  }
}
Say "nssm: $nssm"

# 3. Express, once
if (-not (Test-Path (Join-Path $Dir 'node_modules\express'))) {
  $npm = (& where.exe npm.cmd 2>$null | Select-Object -First 1)
  if (-not $npm) { throw 'npm.cmd not found next to node. Reinstall Node.js.' }
  if ($PSCmdlet.ShouldProcess($Dir, 'npm install --omit=dev')) {
    Push-Location $Dir
    try { & $npm install --omit=dev; if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' } } finally { Pop-Location }
  }
}

# 4. service
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
  if ($PSCmdlet.ShouldProcess($ServiceName, 'stop existing service to update it')) {
    & $nssm stop $ServiceName | Out-Null
  }
} else {
  if ($PSCmdlet.ShouldProcess($ServiceName, "nssm install $node server.js")) {
    & $nssm install $ServiceName $node server.js
    if ($LASTEXITCODE -ne 0) { throw "nssm install failed ($LASTEXITCODE)." }
  }
}

$settings = [ordered]@{
  Application    = $node
  AppParameters  = 'server.js'
  AppDirectory   = $Dir
  DisplayName    = 'GluMira local model proxy'
  Description    = "GluMira proxy on 127.0.0.1:$Port (Google Gemini, chat.html). Keys from the vault."
  Start          = 'SERVICE_AUTO_START'
  AppStdout      = $OutLog
  AppStderr      = $ErrLog
  AppRotateFiles = '1'
  AppRotateBytes = '1048576'
  AppRotateOnline = '1'                       # rotate while running, so the log handle is not left stale
  AppStdoutCreationDisposition = '4'          # OPEN_ALWAYS: append, reopen existing proxy.log after a restart
  AppStderrCreationDisposition = '4'          # same for proxy.err.log
  AppEnvironmentExtra = @("PORT=$Port", 'PROXY_SELF_RELOAD=1')
  AppExit        = @('Default', 'Restart') # any exit (code update or crash) -> NSSM starts it again
}
foreach ($k in $settings.Keys) {
  $v = @($settings[$k])
  if ($PSCmdlet.ShouldProcess($ServiceName, "nssm set $k $($v -join ' ')")) {
    & $nssm set $ServiceName $k @v | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "nssm set $k failed ($LASTEXITCODE)." }
  }
}

if ($PSCmdlet.ShouldProcess($ServiceName, 'start service')) {
  & $nssm start $ServiceName | Out-Null
  Start-Sleep -Seconds 3
}

# 5. report
if ($DryRun) { Say 'Dry run finished. Nothing was changed.'; return }
Get-Service -Name $ServiceName | Format-Table Name, Status, StartType -AutoSize
foreach ($log in @($OutLog, $ErrLog)) {
  if (Test-Path $log) { Say "tail $log"; Get-Content $log -Tail 15 }
}
try {
  $h = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 5
  Say "health: ok=$($h.ok) key_present=$($h.key_present)"
  Say "chat: http://127.0.0.1:$Port/chat.html"
} catch {
  Say "health check failed: $($_.Exception.Message). See $ErrLog"
}
Pause-IfWindow
