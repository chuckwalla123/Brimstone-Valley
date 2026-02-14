param(
  [string]$Message = "Backup local work"
)

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
  throw "Git is not installed or not in PATH."
}

$inside = git rev-parse --is-inside-work-tree 2>$null
if ($inside -ne 'true') {
  throw "Current directory is not a git repository: $repo"
}

$origin = git remote get-url origin 2>$null
if (-not $origin) {
  throw "No 'origin' remote is configured. Add one first (git remote add origin <url>)."
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if (-not $branch) {
  throw "Unable to detect current branch."
}

Write-Host "[backup] Repository: $repo"
Write-Host "[backup] Branch: $branch"
Write-Host "[backup] Origin: $origin"

# Stage everything
& git add -A

# If no staged changes, skip commit and only push
$hasStaged = (& git diff --cached --name-only).Trim()
if ($hasStaged) {
  & git commit -m $Message
  Write-Host "[backup] Commit created with message: $Message"
} else {
  Write-Host "[backup] No new changes to commit."
}

# Push and set upstream if needed
$upstream = git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
if ($LASTEXITCODE -eq 0 -and $upstream) {
  & git push
} else {
  & git push -u origin $branch
}

Write-Host "[backup] Done."
