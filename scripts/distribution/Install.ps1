param([string]$GamePath, [switch]$Launch)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'GamePath.ps1')
$packageRoot = Split-Path $PSScriptRoot -Parent
$game = Resolve-BigWalkPath $GamePath
if (Get-Process 'Big Walk' -ErrorAction SilentlyContinue) { throw 'Close Big Walk, then run Install again.' }
$loader = Join-Path $game 'BepInEx\core\BepInEx.Unity.IL2CPP.dll'
if (!(Test-Path -LiteralPath $loader)) {
    foreach ($entry in @('BepInEx', 'winhttp.dll', 'doorstop_config.ini', 'dotnet')) {
        if (Test-Path -LiteralPath (Join-Path $game $entry)) {
            throw "Existing loader files were found ($entry). Nothing was replaced. Install the BepInEx 6 IL2CPP x64 loader manually using the links in START HERE.txt, then run this installer again."
        }
    }
    Expand-Archive -LiteralPath (Join-Path $packageRoot 'installer\BepInEx-Unity.IL2CPP-win-x64-6.0.0-be.788.zip') -DestinationPath $game
    Write-Host 'Installed BepInEx 6 IL2CPP x64.'
} else {
    Write-Host 'Keeping your existing BepInEx loader and configuration.'
}
$pluginFolder = Join-Path $game 'BepInEx\plugins\BigWalk.Companion'
New-Item -ItemType Directory -Force -Path $pluginFolder | Out-Null
$pluginFile = Join-Path $pluginFolder 'BigWalk.Companion.dll'
if (Test-Path -LiteralPath $pluginFile) {
    $backupFolder = Join-Path $packageRoot 'backups'
    New-Item -ItemType Directory -Force -Path $backupFolder | Out-Null
    Copy-Item -LiteralPath $pluginFile -Destination (Join-Path $backupFolder (('BigWalk.Companion-{0}.dll.bak' -f (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))))
}
Copy-Item -LiteralPath (Join-Path $packageRoot 'mod\BigWalk.Companion.dll') -Destination $pluginFile -Force
Write-Host 'Installed Big Walk Companion. The first modded game launch can take several minutes.'
if ($Launch) {
    $steamApps = Split-Path (Split-Path $game -Parent) -Parent
    $appId = $null
    foreach ($manifest in Get-ChildItem -LiteralPath $steamApps -Filter 'appmanifest_*.acf' -ErrorAction SilentlyContinue) {
        $content = Get-Content -LiteralPath $manifest.FullName -Raw
        if ($content -match '"installdir"\s+"([^"]+)"' -and $Matches[1] -eq (Split-Path $game -Leaf)) {
            if ($content -match '"appid"\s+"(\d+)"') { $appId = $Matches[1]; break }
        }
    }
    if ($appId) { Start-Process "steam://rungameid/$appId" }
    else { Start-Process -FilePath (Join-Path $game 'Big Walk.exe') -WorkingDirectory $game }
    & (Join-Path $PSScriptRoot 'Start.ps1')
} else {
    Write-Host 'Launch Big Walk through Steam, join a world, and run Start Companion.cmd.'
}
