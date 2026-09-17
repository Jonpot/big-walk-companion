# Uses isolated fake game folders; never installs into the real game.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$fixture = Join-Path $projectRoot ('.local\distribution-test-' + [Guid]::NewGuid().ToString('N'))
$package = Join-Path $fixture 'package'
$game = Join-Path $fixture 'steamapps\common\fake-game'
foreach ($folder in @("$package\scripts", "$package\installer", "$package\mod", "$game", "$fixture\loader\BepInEx\core")) {
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
}
foreach ($file in Get-ChildItem (Join-Path $PSScriptRoot 'distribution') -Filter '*.ps1') {
    $tokens = $null; $parseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$parseErrors) | Out-Null
    if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
    Copy-Item -LiteralPath $file.FullName -Destination "$package\scripts"
}
[IO.File]::WriteAllText("$game\Big Walk.exe", 'fixture')
[IO.File]::WriteAllText("$fixture\loader\BepInEx\core\BepInEx.Unity.IL2CPP.dll", 'fixture-loader')
[IO.File]::WriteAllText("$fixture\loader\doorstop_config.ini", 'fixture-config')
[IO.File]::WriteAllText("$fixture\loader\winhttp.dll", 'fixture-proxy')
[IO.File]::WriteAllText("$package\mod\BigWalk.Companion.dll", 'fixture-plugin')
Compress-Archive -Path "$fixture\loader\*" -DestinationPath "$package\installer\BepInEx-Unity.IL2CPP-win-x64-6.0.0-be.788.zip"
# Shadow only the process lookup inside this test scope so a real running game
# does not prevent exercising the installer against these inert fixture files.
function Get-Process { param([string]$Name) }
& "$package\scripts\Install.ps1" -GamePath $game
if ((Get-Content -LiteralPath "$game\BepInEx\plugins\BigWalk.Companion\BigWalk.Companion.dll" -Raw) -ne 'fixture-plugin') { throw 'Fresh install failed.' }
[IO.File]::WriteAllText("$game\doorstop_config.ini", 'keep-me')
[IO.File]::WriteAllText("$package\mod\BigWalk.Companion.dll", 'updated-plugin')
& "$package\scripts\Install.ps1" -GamePath $game
if ((Get-Content -LiteralPath "$game\doorstop_config.ini" -Raw) -ne 'keep-me') { throw 'Existing configuration was changed.' }
if (@(Get-ChildItem -LiteralPath "$package\backups" -Filter '*.bak').Count -ne 1) { throw 'Plugin backup missing.' }
$conflict = Join-Path $fixture 'conflicting-game'
New-Item -ItemType Directory -Path $conflict | Out-Null
[IO.File]::WriteAllText("$conflict\Big Walk.exe", 'fixture')
[IO.File]::WriteAllText("$conflict\winhttp.dll", 'keep-loader')
$rejected = $false
try { & "$package\scripts\Install.ps1" -GamePath $conflict } catch { $rejected = $_.Exception.Message -like '*differs from the bundled loader*' -and $_.Exception.Message.Contains($conflict) -and $_.Exception.Message.Contains('mod manager') }
if (!$rejected) { throw 'Conflicting loader was not rejected.' }
if ((Get-Content -LiteralPath "$conflict\winhttp.dll" -Raw) -ne 'keep-loader') { throw 'Conflicting loader changed.' }
if (Test-Path -LiteralPath "$conflict\BepInEx") { throw 'Conflict preflight wrote loader files.' }
# A leftover proxy from the same loader is repairable without overwriting it.
$partial = Join-Path $fixture 'partial-game'
New-Item -ItemType Directory -Path $partial | Out-Null
[IO.File]::WriteAllText("$partial\Big Walk.exe", 'fixture')
[IO.File]::WriteAllText("$partial\winhttp.dll", 'fixture-proxy')
& "$package\scripts\Install.ps1" -GamePath $partial
if (!(Test-Path -LiteralPath "$partial\BepInEx\core\BepInEx.Unity.IL2CPP.dll")) { throw 'Partial loader repair failed.' }
if ((Get-Content -LiteralPath "$partial\winhttp.dll" -Raw) -ne 'fixture-proxy') { throw 'Partial loader proxy changed.' }
# An incompatible BepInEx must not be mixed with the bundled IL2CPP loader.
$mono = Join-Path $fixture 'mono-game'
New-Item -ItemType Directory -Path "$mono\BepInEx\core" -Force | Out-Null
[IO.File]::WriteAllText("$mono\Big Walk.exe", 'fixture')
[IO.File]::WriteAllText("$mono\BepInEx\core\BepInEx.dll", 'old-loader')
$rejected = $false
try { & "$package\scripts\Install.ps1" -GamePath $mono } catch { $rejected = $_.Exception.Message -like '*incompatible BepInEx*' }
if (!$rejected -or (Test-Path -LiteralPath "$mono\winhttp.dll")) { throw 'Incompatible BepInEx was modified.' }
Write-Output 'PASS: fresh install, existing loader/config preservation, plugin backup, conflicting loader rejection, script parsing.'
Write-Output "Fixtures: $fixture"

# Exercise automatic launch without starting a real game or server.
[IO.File]::WriteAllText("$package\scripts\Start.ps1", '$global:companionStarted = $true')
function Start-Process { param([string]$FilePath, [string]$WorkingDirectory) $global:launchedFile = $FilePath }
& "$package\scripts\Install.ps1" -GamePath $game -Launch
if ($global:launchedFile -ne "$game\Big Walk.exe" -or !$global:companionStarted) { throw 'Automatic launch failed.' }
[IO.File]::WriteAllText((Join-Path (Split-Path (Split-Path $game -Parent) -Parent) 'appmanifest_123456.acf'), '"appid" "123456" "installdir" "fake-game"')
& "$package\scripts\Install.ps1" -GamePath $game -Launch
if ($global:launchedFile -ne 'steam://rungameid/123456') { throw 'Steam launch failed.' }
Write-Output 'PASS: automatic game and companion launch, Steam manifest launch.'

# Managed profiles install outside the game and must never launch vanilla automatically.
$profile = Join-Path $fixture 'manager profile [test]'
New-Item -ItemType Directory -Path "$profile\BepInEx\core" -Force | Out-Null
[IO.File]::WriteAllText("$profile\BepInEx\core\BepInEx.Unity.IL2CPP.dll", 'managed-loader')
$global:launchedFile = $null; $global:companionStarted = $false
& "$package\scripts\Install.ps1" -GamePath $conflict -BepInExPath $profile -Launch
if ($global:launchedFile -or !$global:companionStarted) { throw 'Managed launch started vanilla or failed to open companion.' }
if (!(Test-Path -LiteralPath "$profile\BepInEx\plugins\BigWalk.Companion\BigWalk.Companion.dll")) { throw 'Managed plugin missing.' }
if (Test-Path -LiteralPath "$conflict\BepInEx") { throw 'Managed install wrote into the game folder.' }
& "$package\scripts\Install.ps1" -GamePath $conflict
$saved = Get-Content -LiteralPath "$package\install-location.json" -Raw | ConvertFrom-Json
if ($saved.bepInEx -ne "$profile\BepInEx") { throw 'Profile selection was not remembered.' }
& "$package\scripts\Install.ps1" -GamePath $game -UseGameFolder
$saved = Get-Content -LiteralPath "$package\install-location.json" -Raw | ConvertFrom-Json
if ($saved.bepInEx -ne "$game\BepInEx") { throw 'Switching back to game installation failed.' }
Write-Output 'PASS: managed profile, remembered selection, explicit game selection, no vanilla launch.'

# Diagnostics contain only targeted fixture logs, report missing files, and omit dumps by default.
$unity = Join-Path $fixture 'unity logs'
$crashes = Join-Path $fixture 'crashes'
New-Item -ItemType Directory -Path $unity,"$crashes\report-one" -Force | Out-Null
[IO.File]::WriteAllText("$unity\Player.log", 'fixture-player-log')
[IO.File]::WriteAllText("$unity\bigwalk-fixture.log", 'fixture-game-log')
[IO.File]::WriteAllText("$game\ErrorLog.log", 'fixture-stack-overflow')
[IO.File]::WriteAllText("$unity\savegame.dat", 'do-not-collect')
[IO.File]::WriteAllText("$profile\BepInEx\LogOutput.log", 'fixture-bep-log')
[IO.File]::WriteAllText("$crashes\report-one\error.log", 'fixture-crash-log')
[IO.File]::WriteAllText("$crashes\report-one\crash.dmp", 'fixture-dump')
$archive = & "$package\scripts\Collect-Diagnostics.ps1" -GamePath $game -BepInExPath $profile -UnityLogPath $unity -CrashPath $crashes -OutputDirectory "$fixture\diagnostics"
$zip = [IO.Compression.ZipFile]::OpenRead($archive)
try {
    $names = @($zip.Entries | ForEach-Object { $_.FullName.Replace('\','/') })
    foreach ($suffix in @('/unity/Player.log','/unity/bigwalk-fixture.log','/game/ErrorLog.log','/bepinex/LogOutput.log','/crashes/report-one/error.log','/README.txt')) {
        if (!($names | Where-Object { $_.EndsWith($suffix) })) { throw "Diagnostics missing $suffix" }
    }
    if ($names -match 'savegame|crash\.dmp') { throw 'Diagnostics included excluded content.' }
} finally { $zip.Dispose() }
$archive = & "$package\scripts\Collect-Diagnostics.ps1" -GamePath $game -BepInExPath $profile -UnityLogPath $unity -CrashPath $crashes -OutputDirectory "$fixture\diagnostics" -IncludeCrashDumps
$zip = [IO.Compression.ZipFile]::OpenRead($archive)
try { if (!($zip.Entries.FullName -match 'crash.dmp')) { throw 'Requested crash dump missing.' } } finally { $zip.Dispose() }
Write-Output 'PASS: diagnostic ZIP, managed logs, missing logs tolerated, dump opt-in, save data excluded.'
