param([string]$GamePath, [switch]$Stop)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'GamePath.ps1')
$packageRoot = Split-Path $PSScriptRoot -Parent
$env:BIGWALK_PATH = Resolve-BigWalkPath $GamePath
$bepFolder = Get-SavedBepInExFolder $env:BIGWALK_PATH
if ($bepFolder) { $bepFolder = Resolve-BepInExFolder $bepFolder }
else { $bepFolder = Join-Path $env:BIGWALK_PATH 'BepInEx' }
$env:COMPANION_TELEMETRY_DIR = Join-Path $bepFolder 'companion'
$env:COMPANION_DATA_DIR = Get-CompanionDataFolder $env:BIGWALK_PATH
$env:COMPANION_OPEN_BROWSER = '1'
$env:PORT = '4317'
$launchArguments = @((Join-Path $packageRoot 'companion\launch.mjs'))
if ($Stop) { $launchArguments += '--stop' }
& (Join-Path $packageRoot 'runtime\node.exe') @launchArguments
if ($LASTEXITCODE -ne 0) { throw "Companion startup failed. See $env:COMPANION_DATA_DIR\launcher.log." }
if (!$Stop) { Write-Host 'The companion is running in the background. You can close this window.' }
