param([string]$GamePath, [string]$BepInExPath, [string]$UnityLogPath, [string]$CrashPath,
    [string]$OutputDirectory, [switch]$IncludeCrashDumps)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'GamePath.ps1')
$packageRoot = Split-Path $PSScriptRoot -Parent
$game = Resolve-BigWalkPath $GamePath
if (!$BepInExPath) { $BepInExPath = Get-SavedBepInExFolder $game }
if (!$BepInExPath) { $BepInExPath = Join-Path $game 'BepInEx' }
elseif (Test-Path -LiteralPath (Join-Path $BepInExPath 'BepInEx') -PathType Container) { $BepInExPath = Join-Path $BepInExPath 'BepInEx' }
if (!$UnityLogPath) { $UnityLogPath = Join-Path $env:USERPROFILE 'AppData\LocalLow\House House\Big Walk' }
if (!$CrashPath) { $CrashPath = Join-Path ([IO.Path]::GetTempPath()) 'House House\Big Walk\Crashes' }
if (!$OutputDirectory) { $OutputDirectory = Join-Path $packageRoot 'diagnostics' }
$name = 'BigWalk-diagnostics-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
$stage = Join-Path $OutputDirectory $name
New-Item -ItemType Directory -Path $stage -Force | Out-Null
$report = [Collections.Generic.List[string]]::new()
$report.Add("Collected UTC: $([DateTime]::UtcNow.ToString('o'))")
$report.Add("PowerShell: $($PSVersionTable.PSVersion); OS: $([Environment]::OSVersion.VersionString)")
$report.Add("Game: $game")
$report.Add("BepInEx: $BepInExPath")
$report.Add("Unity logs: $UnityLogPath")
$report.Add("Crash folder: $CrashPath")
$report.Add('This bundle contains existing logs, not a new crash capture. No files are uploaded.')
$report.Add('Logs may contain player names and local paths. Review before sharing privately.')
$report.Add('Full recordings, route notes, save games, and game artwork are excluded.')
$report.Add("Crash dumps included on request: $([bool]$IncludeCrashDumps)")
$script:diagnosticBytes = 0L
function Copy-DiagnosticFile([string]$Source, [string]$Relative) {
    try {
        if (!(Test-Path -LiteralPath $Source -PathType Leaf)) { $report.Add("Missing: $Source"); return }
        $info = Get-Item -LiteralPath $Source
        if (($info.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { $report.Add("Skipped linked file: $Source"); return }
        if ($info.Length -gt 100MB -or $script:diagnosticBytes + $info.Length -gt 200MB) { $report.Add("Skipped oversized file: $Source ($($info.Length) bytes)"); return }
        $destination = Join-Path $stage $Relative
        New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $Source -Destination $destination
        $script:diagnosticBytes += $info.Length
        $report.Add("Included: $Relative; modified UTC: $($info.LastWriteTimeUtc.ToString('o'))")
    } catch { $report.Add("Could not read $Source : $($_.Exception.Message)") }
}
foreach ($file in @('Player.log', 'Player-prev.log')) { Copy-DiagnosticFile (Join-Path $UnityLogPath $file) "unity\$file" }
foreach ($file in @(Get-ChildItem -LiteralPath $UnityLogPath -Filter 'bigwalk-*.log' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 3)) {
    Copy-DiagnosticFile $file.FullName (Join-Path 'unity' $file.Name)
}
Copy-DiagnosticFile (Join-Path $BepInExPath 'LogOutput.log') 'bepinex\LogOutput.log'
Copy-DiagnosticFile (Join-Path $BepInExPath 'ErrorLog.log') 'bepinex\ErrorLog.log'
Copy-DiagnosticFile (Join-Path $game 'ErrorLog.log') 'game\ErrorLog.log'
Copy-DiagnosticFile (Join-Path $game 'doorstop_config.ini') 'bepinex\doorstop_config.ini'
Copy-DiagnosticFile (Join-Path $BepInExPath 'config\com.jonpot.bigwalk.companion.cfg') 'companion\plugin-config.txt'
Copy-DiagnosticFile (Join-Path $BepInExPath 'companion\positions.json') 'companion\positions.json'
Copy-DiagnosticFile (Join-Path $packageRoot 'install-location.json') 'companion\install-location.json'
$notesDirectory = Get-CompanionDataFolder $game
Copy-DiagnosticFile (Join-Path $notesDirectory 'launcher.log') 'companion\launcher.log'
Copy-DiagnosticFile (Join-Path $notesDirectory 'server.log') 'companion\server.log'
try {
    $inventory = @(Get-ChildItem -LiteralPath (Join-Path $BepInExPath 'plugins') -Filter '*.dll' -File -Recurse -ErrorAction Stop | ForEach-Object {
        @{file=$_.FullName.Substring($BepInExPath.Length).TrimStart('\'); version=$_.VersionInfo.FileVersion;
          sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
    })
    [IO.File]::WriteAllText((Join-Path $stage 'plugins.json'), (ConvertTo-Json -InputObject $inventory -Depth 4))
} catch { $report.Add("Plugin inventory unavailable: $($_.Exception.Message)") }
if (Test-Path -LiteralPath $CrashPath -PathType Container) {
    try {
        # Restrict collection to the three newest report directories under this game's crash folder.
        $crashes = @(Get-ChildItem -LiteralPath $CrashPath -Directory -ErrorAction Stop | Where-Object {
            ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0
        } | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 3)
        $report.Add("Crash folders found: $($crashes.Count) (up to three newest collected)")
        foreach ($crash in $crashes) {
            foreach ($file in Get-ChildItem -LiteralPath $crash.FullName -File -ErrorAction Stop) {
                if ($file.Extension -in @('.log','.txt') -or ($IncludeCrashDumps -and $file.Extension -eq '.dmp')) {
                    Copy-DiagnosticFile $file.FullName (Join-Path ('crashes\' + $crash.Name) $file.Name)
                } elseif ($file.Extension -eq '.dmp') { $report.Add("Dump available (not included): $($file.FullName)") }
            }
        }
    } catch { $report.Add("Crash files unavailable: $($_.Exception.Message)") }
} else { $report.Add('No Unity crash folder found. Not every crash produces a report.') }
$report.Add('When reporting: include approximate crash time/time zone, what you were doing, mod manager/profile, and whether it happens without the companion plugin.')
[IO.File]::WriteAllLines((Join-Path $stage 'README.txt'), $report)
$archive = $stage + '.zip'
Compress-Archive -LiteralPath $stage -DestinationPath $archive
Write-Host "Diagnostics ZIP: $archive"
Write-Host 'Review it, then send it privately with the crash time and what you were doing. Nothing was uploaded.'
Write-Output $archive
