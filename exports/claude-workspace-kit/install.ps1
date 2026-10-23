<#
  Claude workspace kit - installer

  Usage (run from the kit folder):
    # Core workspace into a new repo: CLAUDE.md (+ AGENTS.md mirror), .claudeignore, .claude\ (skills, settings, launch),
    # docs\ skeletons, docs\workspace-rules\ (the rule chapters), CHANGELOG.md
    .\install.ps1 -Target "D:\my-new-app"

    # Same, plus the NestJS + Prisma + Next.js stack pack (stack skills + apps\backend|frontend\CLAUDE.md)
    .\install.ps1 -Target "D:\my-new-app" -Stack

    # Same, plus the optional skills
    .\install.ps1 -Target "D:\my-new-app" -Stack -Optional

    # Machine-wide user settings + founder commands into ~/.claude (only needed on a new machine)
    .\install.ps1 -UserLevel

  Existing files are never overwritten silently: they are backed up to <target>\.claude\kit-backup-<timestamp>\ first.
  Add -WhatIf to preview without writing anything.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$Target,
  [switch]$Stack,
  [switch]$Optional,
  [switch]$UserLevel
)

$ErrorActionPreference = 'Stop'
$Kit = $PSScriptRoot
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function Copy-WithBackup([string]$From, [string]$To, [string]$Root) {
  if (Test-Path $To) {
    $rel = $To.Substring($Root.Length).TrimStart('\')
    $bak = Join-Path (Join-Path $Root ".claude\kit-backup-$Stamp") $rel
    if ($PSCmdlet.ShouldProcess($To, "back up to $bak")) {
      New-Item -ItemType Directory -Force (Split-Path $bak) | Out-Null
      Copy-Item -Recurse -Force $To $bak
      Remove-Item -Recurse -Force $To
    }
  }
  if ($PSCmdlet.ShouldProcess($To, "copy from $From")) {
    New-Item -ItemType Directory -Force (Split-Path $To) | Out-Null
    Copy-Item -Recurse -Force $From $To
  }
}

if (-not $Target -and -not $UserLevel) { throw 'Pass -Target <repo path> and/or -UserLevel.' }

if ($Target) {
  if (-not (Test-Path $Target)) { throw "Target not found: $Target" }
  $Target = (Resolve-Path $Target).Path

  # project-template\* -> repo root (item by item so existing repos keep their other files)
  $tpl = Join-Path $Kit 'project-template'
  foreach ($f in Get-ChildItem -Force $tpl -File) { Copy-WithBackup $f.FullName (Join-Path $Target $f.Name) $Target }
  foreach ($f in Get-ChildItem -Force (Join-Path $tpl '.claude') -File) { Copy-WithBackup $f.FullName (Join-Path $Target ".claude\$($f.Name)") $Target }
  foreach ($s in Get-ChildItem (Join-Path $tpl '.claude\skills') -Directory) { Copy-WithBackup $s.FullName (Join-Path $Target ".claude\skills\$($s.Name)") $Target }
  if (Test-Path (Join-Path $tpl 'docs')) {
    foreach ($f in Get-ChildItem (Join-Path $tpl 'docs') -File) { Copy-WithBackup $f.FullName (Join-Path $Target "docs\$($f.Name)") $Target }
  }
  # rule chapters -> docs\workspace-rules\ (CLAUDE.md points there)
  foreach ($f in Get-ChildItem (Join-Path $Kit 'rules') -File) { Copy-WithBackup $f.FullName (Join-Path $Target "docs\workspace-rules\$($f.Name)") $Target }
  # AGENTS.md = byte-identical mirror of CLAUDE.md (re-copy after you fill the placeholders)
  Copy-WithBackup (Join-Path $Target 'CLAUDE.md') (Join-Path $Target 'AGENTS.md') $Target

  if ($Stack) {
    $sp = Join-Path $Kit 'stack-pack'
    foreach ($s in Get-ChildItem (Join-Path $sp '.claude\skills') -Directory) { Copy-WithBackup $s.FullName (Join-Path $Target ".claude\skills\$($s.Name)") $Target }
    Copy-WithBackup (Join-Path $sp 'backend.CLAUDE.md') (Join-Path $Target 'apps\backend\CLAUDE.md') $Target
    Copy-WithBackup (Join-Path $sp 'frontend.CLAUDE.md') (Join-Path $Target 'apps\frontend\CLAUDE.md') $Target
    Copy-WithBackup (Join-Path $sp 'STACK-RULES.md') (Join-Path $Target 'docs\STACK-RULES.md') $Target
  }

  if ($Optional -and (Test-Path (Join-Path $Kit 'optional\skills'))) {
    foreach ($s in Get-ChildItem (Join-Path $Kit 'optional\skills') -Directory) { Copy-WithBackup $s.FullName (Join-Path $Target ".claude\skills\$($s.Name)") $Target }
  }

  Write-Host "Installed into $Target."
  Write-Host "Next: fill the <PLACEHOLDERS> in CLAUDE.md and docs\*.md (search for '<'), then: Copy-Item CLAUDE.md AGENTS.md -Force"
}

if ($UserLevel) {
  $home2 = Join-Path $env:USERPROFILE '.claude'
  Copy-WithBackup (Join-Path $Kit 'user-level\settings.json') (Join-Path $home2 'settings.json') $home2
  Copy-WithBackup (Join-Path $Kit 'user-level\commands\founder') (Join-Path $home2 'commands\founder') $home2
  Write-Host "User-level settings + /founder:* commands installed into $home2 (plugins install on next Claude Code start)."
}
