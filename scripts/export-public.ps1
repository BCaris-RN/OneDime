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
  ":(glob)**/.env*",
  ":(exclude,glob)**/.env.example"
)
# Applied to the exported README only, so it doesn't point at files the export leaves out.
$ReadmeRewrites = [ordered]@{
  'are in `STATUS\.md` and \[PR #5\]' = 'are in [PR #5]'
  'under `reviews/beta-allowlist/`\.' = 'in a local review folder.'
  ' and checkpoint evidence in\s+\[STATUS\.md\]\(STATUS\.md\)\. \[Phase 4 decisions\]\(docs/phase4-decisions\.md\) record calculations,\s+dependencies, scope choices and provider limitations\.' = '.'
  '\r?\n\r?\nFor the public release I run `scripts/export-public\.ps1`[\s\S]*?a repository public is a separate step I take myself\.' = ''
}
# Matched case-insensitively against every path and every file's content, binaries included.
$EmployerPattern = "vencer"

function Invoke-Git {
  $output = & git @args
  if ($LASTEXITCODE -ne 0) { throw "git $(@($args | ForEach-Object { $_ }) -join ' ') failed with exit code $LASTEXITCODE" }
  $output
}

# Native output piped through Windows PowerShell is re-encoded, so blobs move as raw bytes.
function Read-GitBlob([string]$spec) {
  $info = New-Object Diagnostics.ProcessStartInfo "git", "-C `"$repo`" cat-file blob $spec"
  $info.RedirectStandardOutput = $true
  $info.UseShellExecute = $false
  $process = [Diagnostics.Process]::Start($info)
  $bytes = New-Object IO.MemoryStream
  $process.StandardOutput.BaseStream.CopyTo($bytes)
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw "git cat-file blob $spec failed with exit code $($process.ExitCode)" }
  [Text.Encoding]::UTF8.GetString($bytes.ToArray())
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
$readmeFile = Join-Path ([IO.Path]::GetTempPath()) "onedime-export-$PID.md"
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

  $readme = Read-GitBlob ":README.md"
  foreach ($rewrite in $ReadmeRewrites.GetEnumerator()) { $readme = $readme -replace $rewrite.Key, $rewrite.Value }
  # Excluded folders are matched by their top level so new files in them are caught too.
  $excludedReferences = $excluded | ForEach-Object {
    if ($_ -match "^([^/]+)/" -and $Matches[1] -ne "docs") { "$($Matches[1])/" } else { $_ }
  }
  $removedReferences = @(@($excludedReferences) + @($employerFiles) | Sort-Object -Unique)
  $dangling = @($removedReferences | Where-Object { $readme.Contains($_) })
  if ($dangling.Count -gt 0) {
    throw "README still references $($dangling -join ', '). Add a rewrite to `$ReadmeRewrites."
  }
  [IO.File]::WriteAllText($readmeFile, $readme, (New-Object Text.UTF8Encoding $false))
  $readmeBlob = Invoke-Git -C $repo hash-object -w --no-filters $readmeFile
  Invoke-Git -C $repo update-index --cacheinfo "100644,$readmeBlob,README.md"

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
  Remove-Item $indexFile, $readmeFile -ErrorAction SilentlyContinue
}

$kept = @(Invoke-Git -C $destination ls-files).Count
Write-Output "export: $kept of $before files from $sourceCommit in $destination"
Write-Output "export: excluded $($excluded.Count) by path rule and $($employerFiles.Count) naming an employer"
foreach ($file in $employerFiles) { Write-Output "export: employer-named file left out: $file" }
Write-Output "export: README rewritten so it links only to exported files"
Write-Output "export: local single-commit repository only; no remote was added"
