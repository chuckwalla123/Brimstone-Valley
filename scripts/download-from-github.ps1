param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Repository,

  [string]$Destination = "",

  [string]$Branch = "",

  [switch]$UseGit
)

$ErrorActionPreference = 'Stop'

function Resolve-GithubRepoInfo {
  param([string]$InputRepository)

  if ($InputRepository -in @('owner/repo', 'https://github.com/owner/repo', 'https://github.com/owner/repo.git')) {
    throw "Replace the placeholder repository value with a real GitHub repo, like owner/project-name or https://github.com/owner/project-name."
  }

  if ($InputRepository -match '^https://github\.com/(?<owner>[^/]+)/(?<name>[^/]+?)(?:\.git)?/?$') {
    return [pscustomobject]@{
      Owner = $Matches.owner
      Name = $Matches.name
      CloneUrl = "https://github.com/$($Matches.owner)/$($Matches.name).git"
      ArchiveBaseUrl = "https://codeload.github.com/$($Matches.owner)/$($Matches.name)/zip/refs/heads"
    }
  }

  if ($InputRepository -match '^(?<owner>[^/]+)/(?<name>[^/]+)$') {
    return [pscustomobject]@{
      Owner = $Matches.owner
      Name = $Matches.name
      CloneUrl = "https://github.com/$($Matches.owner)/$($Matches.name).git"
      ArchiveBaseUrl = "https://codeload.github.com/$($Matches.owner)/$($Matches.name)/zip/refs/heads"
    }
  }

  throw "Repository must be in the form owner/name or https://github.com/owner/name"
}

function Resolve-GithubDefaultBranch {
  param([string]$Owner, [string]$Name)

  $apiUrl = "https://api.github.com/repos/$Owner/$Name"
  try {
    $repoInfo = Invoke-RestMethod -Uri $apiUrl -Headers @{ 'User-Agent' = 'BrimstoneValleyDownloader' }
    if ($repoInfo.default_branch) {
      return $repoInfo.default_branch
    }
  } catch {
    Write-Host "[download] Could not read default branch from GitHub API; falling back to master/main."
  }

  return 'master'
}

$repo = Resolve-GithubRepoInfo -InputRepository $Repository
$Branch = if ($Branch) { $Branch } else { Resolve-GithubDefaultBranch -Owner $repo.Owner -Name $repo.Name }
$targetFolder = if ($Destination) { $Destination } else { $repo.Name }

Write-Host "[download] Repository: $($repo.Owner)/$($repo.Name)"
Write-Host "[download] Destination: $targetFolder"

$git = Get-Command git -ErrorAction SilentlyContinue
$targetExists = Test-Path -LiteralPath $targetFolder

if (($UseGit -or $git) -and $git) {
  if ($targetExists) {
    $gitDir = Join-Path $targetFolder '.git'
    if (Test-Path -LiteralPath $gitDir) {
      Push-Location $targetFolder
      try {
        & git pull --ff-only origin $Branch
      } finally {
        Pop-Location
      }
      Write-Host "[download] Updated existing clone with git pull."
      return
    }

    throw "Destination already exists and is not a git repository: $targetFolder"
  }

  & git clone --branch $Branch $repo.CloneUrl $targetFolder
  Write-Host "[download] Cloned repository with git."
  return
}

if ($targetExists) {
  throw "Destination already exists: $targetFolder"
}

$archiveUrl = "$($repo.ArchiveBaseUrl)/$Branch"
$zipFile = Join-Path $env:TEMP "$($repo.Name)-$Branch.zip"
$extractRoot = Join-Path $env:TEMP "$($repo.Name)-$Branch-extract"

if (Test-Path -LiteralPath $zipFile) {
  Remove-Item -LiteralPath $zipFile -Force
}

if (Test-Path -LiteralPath $extractRoot) {
  Remove-Item -LiteralPath $extractRoot -Recurse -Force
}

Invoke-WebRequest -Uri $archiveUrl -OutFile $zipFile
Expand-Archive -LiteralPath $zipFile -DestinationPath $extractRoot -Force

$expandedFolder = Get-ChildItem -LiteralPath $extractRoot | Select-Object -First 1
if (-not $expandedFolder) {
  throw "Downloaded archive was empty."
}

Move-Item -LiteralPath $expandedFolder.FullName -Destination $targetFolder
Remove-Item -LiteralPath $zipFile -Force
Remove-Item -LiteralPath $extractRoot -Recurse -Force

Write-Host "[download] Downloaded repository archive."
Write-Host "[download] Open $targetFolder to use the project."