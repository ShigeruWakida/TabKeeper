$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'manifest.json') -Raw | ConvertFrom-Json
$outputDirectory = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$archivePath = Join-Path $outputDirectory "TabKeeper-$($manifest.version).zip"
if (Test-Path -LiteralPath $archivePath) {
    throw "ZIP already exists: $archivePath"
}
$files = @('manifest.json', 'background.js', 'popup.html', 'popup.css', 'popup.js', 'folder.js', 'session.js', 'README.md', 'LICENSE')
$sourcePaths = $files | ForEach-Object { Join-Path $projectRoot $_ }
Compress-Archive -LiteralPath $sourcePaths -DestinationPath $archivePath
Write-Output $archivePath
