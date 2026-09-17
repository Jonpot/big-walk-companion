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
