param([string]$GamePath, [switch]$Launch, [string]$BepInExPath, [switch]$UseGameFolder, [switch]$Interactive)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'GamePath.ps1')
. (Join-Path $PSScriptRoot 'Loader.ps1')
$packageRoot = Split-Path $PSScriptRoot -Parent
$game = Resolve-BigWalkPath $GamePath
Write-Host "Installing into: $game"
if (Get-Process 'Big Walk' -ErrorAction SilentlyContinue) { throw 'Close Big Walk, then run Install again.' }
if ($BepInExPath -and $UseGameFolder) { throw 'Choose either -BepInExPath or -UseGameFolder, not both.' }
if (!$BepInExPath -and !$UseGameFolder) {
    $BepInExPath = Get-SavedBepInExFolder $game
    if ($Interactive) {
        $current = if ($BepInExPath) { $BepInExPath } else { 'normal game-folder installation' }
        Write-Host "Current selection: $current"
        Write-Host 'If you launch modded through a mod manager, choose M and use its active profile folder.'
        $choice = (Read-Host 'Enter = keep selection, M = mod manager profile, D = normal game folder').Trim()
        if ($choice -eq 'M') { $BepInExPath = Read-Host 'Mod manager profile folder (or its BepInEx folder)' }
        elseif ($choice -eq 'D') { $BepInExPath = $null }
        elseif ($choice) { throw 'Unknown selection. Run Install again and choose Enter, M, or D.' }
        if ($choice -eq 'M' -and [string]::IsNullOrWhiteSpace($BepInExPath)) { throw 'A mod manager profile folder is required.' }
    }
}
if ($BepInExPath) { $bepFolder = Resolve-BepInExFolder $BepInExPath }
else {
    Install-BigWalkLoader $game (Join-Path $packageRoot 'installer\BepInEx-Unity.IL2CPP-win-x64-6.0.0-be.788.zip')
    $bepFolder = Join-Path $game 'BepInEx'
}
$managed = [IO.Path]::GetFullPath($bepFolder).TrimEnd('\') -ne [IO.Path]::GetFullPath((Join-Path $game 'BepInEx')).TrimEnd('\')
Write-Host "BepInEx folder: $bepFolder"
$pluginFolder = Join-Path $bepFolder 'plugins\BigWalk.Companion'
New-Item -ItemType Directory -Force -Path $pluginFolder | Out-Null
$pluginFile = Join-Path $pluginFolder 'BigWalk.Companion.dll'
if (Test-Path -LiteralPath $pluginFile) {
    $backupFolder = Join-Path $packageRoot 'backups'
    New-Item -ItemType Directory -Force -Path $backupFolder | Out-Null
    Copy-Item -LiteralPath $pluginFile -Destination (Join-Path $backupFolder (('BigWalk.Companion-{0}.dll.bak' -f (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))))
}
Copy-Item -LiteralPath (Join-Path $packageRoot 'mod\BigWalk.Companion.dll') -Destination $pluginFile -Force
$locationFile = Join-Path $packageRoot 'install-location.json'
[IO.File]::WriteAllText(($locationFile + '.tmp'), (@{game=$game; bepInEx=$bepFolder} | ConvertTo-Json))
Move-Item -LiteralPath ($locationFile + '.tmp') -Destination $locationFile -Force
Write-Host 'Installed Big Walk Companion. The first modded game launch can take several minutes.'
if ($managed) {
    Write-Host 'Launch Big Walk MODDED through the mod manager using this profile.'
    if ($Launch) { & (Join-Path $PSScriptRoot 'Start.ps1') }
    else { Write-Host 'Then run Start Companion.cmd; it remembers this profile.' }
} elseif ($Launch) {
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
