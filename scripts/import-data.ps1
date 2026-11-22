$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$importer = Join-Path $scriptDir "import-sheet.mjs"

$node = $null
$onPath = Get-Command node -ErrorAction SilentlyContinue
if ($onPath) { $node = $onPath.Source }

if (-not $node) {
  $portable = Join-Path $env:LOCALAPPDATA "Temp\node-portable\node-v24.21.0-win-x64\node.exe"
  if (Test-Path -LiteralPath $portable) { $node = $portable }
}

if (-not $node) {
  throw "Node.js was not found. Install Node.js, then run this script again."
}

& $node $importer
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
