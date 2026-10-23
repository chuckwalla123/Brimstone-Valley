param(
  [switch]$PrepareOnly,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$FlyArguments
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$stagingRoot = Join-Path $env:TEMP 'brimstone-valley-fly-build'

if (Test-Path $stagingRoot) {
  Remove-Item -Recurse -Force $stagingRoot
}

New-Item -ItemType Directory -Path $stagingRoot | Out-Null

function Copy-DeployFile {
  param([string]$RelativePath)

  $source = Join-Path $projectRoot $RelativePath
  $destination = Join-Path $stagingRoot $RelativePath
  $destinationDirectory = Split-Path -Parent $destination
  New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
  Copy-Item -Force $source $destination
}

Copy-DeployFile 'Dockerfile'
Copy-DeployFile 'fly.toml'
Copy-DeployFile '.dockerignore'

foreach ($directory in @('server', 'shared', 'src/tower', 'src/ai')) {
  Copy-Item -Recurse -Force (Join-Path $projectRoot $directory) (Join-Path $stagingRoot $directory)
}

foreach ($file in @(
  'src/battleEngine.js',
  'src/effects.js',
  'src/heroes.js',
  'src/spell.js',
  'src/spells.js',
  'src/targeting.js'
)) {
  Copy-DeployFile $file
}

$reparsePoints = Get-ChildItem -Force -Recurse $stagingRoot |
  Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }
if ($reparsePoints) {
  throw "Staging directory contains reparse points: $($reparsePoints.FullName -join ', ')"
}

Write-Host "Prepared regular-file Fly build context: $stagingRoot"
if ($PrepareOnly) {
  exit 0
}

Push-Location $stagingRoot
try {
  fly deploy @FlyArguments
} finally {
  Pop-Location
}