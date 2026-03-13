$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$sourcePath = Resolve-Path (Join-Path $projectRoot "..\\excel_output\\trend_tables.json") -ErrorAction SilentlyContinue
$targetDir = Join-Path $projectRoot "assets"
$targetPath = Join-Path $targetDir "trend_tables.json"

if (-not $sourcePath) {
    Write-Error "Source file not found: ..\\excel_output\\trend_tables.json"
    exit 1
}

New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
Copy-Item -Path $sourcePath -Destination $targetPath -Force

Write-Host "Synced trend tables JSON:"
Write-Host "  Source: $sourcePath"
Write-Host "  Target: $targetPath"

