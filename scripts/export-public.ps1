# Builds a clean single-commit copy of HEAD in ..\onedime-public for the public repo.
# Only committed files are read, so .env, node_modules and other untracked files never leave.
# It creates a local repository only: no remote is added and nothing is pushed.

$ErrorActionPreference = "Stop"

$ExcludedPathspecs = @(
  "reviews",
  "handoffs",
  "STATUS.md",
  ":(glob)docs/phase*-decisions.md",
  "feedback",
  "metrics",
  "reference",
  "video",
  ":(glob).env*",
  ":(glob)**/.env*"
)
# Matched case-insensitively against every path and every file's content, binaries included.
$EmployerPattern = "vencer"

function Invoke-Git {
  $output = & git @args
  if ($LASTEXITCODE -ne 0) { throw "git $(@($args | ForEach-Object { $_ }) -join ' ') failed with exit code $LASTEXITCODE" }
  $output
}

$repo = (Invoke-Git -C $PSScriptRoot rev-parse --show-toplevel) -replace "/", "\"
$destination = Join-Path (Split-Path $repo -Parent) "onedime-public"
if (Test-Path $destination) {
  throw "$destination already exists. Move or delete it, then run the export again."
}

$authorName = Invoke-Git -C $repo config user.name
$authorEmail = Invoke-Git -C $repo config user.email
if ("$authorName $authorEmail" -match $EmployerPattern) {
  throw "git identity names an employer. Set your personal user.name and user.email first."
}

$sourceCommit = Invoke-Git -C $repo rev-parse --short HEAD
$exportRef = "refs/onedime-export/tmp"
$indexFile = Join-Path ([IO.Path]::GetTempPath()) "onedime-export-$PID.index"
$previousIndex = $env:GIT_INDEX_FILE
try {
  # A private index lets us filter HEAD's tree without touching the working copy.
  $env:GIT_INDEX_FILE = $indexFile
  Invoke-Git -C $repo read-tree HEAD
  $before = @(Invoke-Git -C $repo ls-files).Count
  $excluded = @(Invoke-Git -C $repo ls-files -- $ExcludedPathspecs)
  Invoke-Git -C $repo rm --cached -r -q --ignore-unmatch -- $ExcludedPathspecs

  $namedByPath = @(Invoke-Git -C $repo ls-files) | Where-Object { $_ -match $EmployerPattern }
  $namedByContent = & git -C $repo grep --cached -l -i -e $EmployerPattern
  if ($LASTEXITCODE -gt 1) { throw "git grep failed with exit code $LASTEXITCODE" }
  $employerFiles = @(@($namedByPath) + @($namedByContent) | Where-Object { $_ } | Sort-Object -Unique)
  foreach ($file in $employerFiles) { Invoke-Git -C $repo rm --cached -q -- ":(literal)$file" }

  & git -C $repo grep --cached -q -i -e $EmployerPattern
  if ($LASTEXITCODE -ne 1) { throw "employer name still present after filtering; nothing was exported" }

  $tree = Invoke-Git -C $repo write-tree
  $env:GIT_AUTHOR_NAME = $authorName; $env:GIT_AUTHOR_EMAIL = $authorEmail
  $env:GIT_COMMITTER_NAME = $authorName; $env:GIT_COMMITTER_EMAIL = $authorEmail
  $commit = Invoke-Git -C $repo commit-tree $tree -m "OneDime public source"
  Invoke-Git -C $repo update-ref $exportRef $commit
  $env:GIT_INDEX_FILE = $previousIndex

  Invoke-Git init -q -b main $destination
  Invoke-Git -C $destination fetch -q $repo $exportRef
  Invoke-Git -C $destination reset -q --hard FETCH_HEAD
} finally {
  $env:GIT_INDEX_FILE = $previousIndex
  foreach ($name in "NAME", "EMAIL") {
    Remove-Item "Env:GIT_AUTHOR_$name", "Env:GIT_COMMITTER_$name" -ErrorAction SilentlyContinue
  }
  & git -C $repo update-ref -d $exportRef
  Remove-Item $indexFile -ErrorAction SilentlyContinue
}

$kept = @(Invoke-Git -C $destination ls-files).Count
Write-Output "export: $kept of $before files from $sourceCommit in $destination"
Write-Output "export: excluded $($excluded.Count) by path rule and $($employerFiles.Count) naming an employer"
foreach ($file in $employerFiles) { Write-Output "export: employer-named file left out: $file" }
Write-Output "export: local single-commit repository only; no remote was added"
