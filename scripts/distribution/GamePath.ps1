$ErrorActionPreference = 'Stop'
function Resolve-BigWalkPath([string]$Requested) {
    $packageRoot = Split-Path $PSScriptRoot -Parent
    $configFile = Join-Path $packageRoot 'game-path.txt'
    $candidates = @()
    if ($Requested) { $candidates += $Requested }
    elseif (Test-Path -LiteralPath $configFile) { $candidates += (Get-Content -LiteralPath $configFile -Raw).Trim() }
    if (!$Requested) {
        $steamRoot = (Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction SilentlyContinue).SteamPath
        if (!$steamRoot) { $steamRoot = Join-Path ${env:ProgramFiles(x86)} 'Steam' }
        $libraries = @($steamRoot)
        $libraryFile = Join-Path $steamRoot 'steamapps\libraryfolders.vdf'
        if (Test-Path -LiteralPath $libraryFile) {
            foreach ($match in [regex]::Matches((Get-Content -LiteralPath $libraryFile -Raw), '"path"\s+"([^"]+)"')) {
                $libraries += $match.Groups[1].Value.Replace('\\', '\')
            }
        }
        foreach ($library in $libraries) { $candidates += Join-Path $library 'steamapps\common\Big Walk' }
    }
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath (Join-Path $candidate 'Big Walk.exe')) {
            $resolved = (Resolve-Path -LiteralPath $candidate).Path
            [IO.File]::WriteAllText($configFile, $resolved)
            return $resolved
        }
    }
    if ($Requested) { throw "Big Walk.exe was not found in $Requested" }
    Write-Host 'In Steam: Big Walk > Manage > Browse local files. Copy that folder path.'
    $entered = (Read-Host 'Big Walk folder').Trim().Trim('"')
    if (!$entered) { throw 'A Big Walk folder is required.' }
    return Resolve-BigWalkPath $entered
}

function Resolve-BepInExFolder([string]$Requested) {
    $folder = $Requested.Trim().Trim('"')
    if (!$folder) { throw 'Choose the mod manager profile folder or its BepInEx folder.' }
    if (Test-Path -LiteralPath (Join-Path $folder 'BepInEx\core\BepInEx.Unity.IL2CPP.dll') -PathType Leaf) {
        $folder = Join-Path $folder 'BepInEx'
    }
    if (!(Test-Path -LiteralPath (Join-Path $folder 'core\BepInEx.Unity.IL2CPP.dll') -PathType Leaf)) {
        throw "BepInEx 6 IL2CPP was not found in '$folder'. In your mod manager, open the active profile folder and select its BepInEx folder. Install the IL2CPP x64 BepInEx package in that profile first."
    }
    return (Resolve-Path -LiteralPath $folder).Path
}

function Get-SavedBepInExFolder([string]$Game) {
    $settings = Join-Path (Split-Path $PSScriptRoot -Parent) 'install-location.json'
    if (!(Test-Path -LiteralPath $settings)) { return $null }
    $saved = Get-Content -LiteralPath $settings -Raw | ConvertFrom-Json
    if ($saved.game -ne $Game) { return $null }
    return $saved.bepInEx
}

function Get-CompanionDataFolder([string]$Game) {
    $packageRoot = Split-Path $PSScriptRoot -Parent
    $settings = Join-Path $packageRoot 'install-location.json'
    if (Test-Path -LiteralPath $settings) {
        $saved = Get-Content -LiteralPath $settings -Raw | ConvertFrom-Json
        if ($saved.game -eq $Game -and $saved.dataDirectory) { return $saved.dataDirectory }
    }
    return Join-Path $packageRoot 'data'
}
