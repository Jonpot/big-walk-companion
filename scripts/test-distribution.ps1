# Uses isolated fake game folders; never installs into the real game.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$fixture = Join-Path $projectRoot ('.local\distribution-test-' + [Guid]::NewGuid().ToString('N'))
$package = Join-Path $fixture 'package'
$game = Join-Path $fixture 'fake-game'
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
try { & "$package\scripts\Install.ps1" -GamePath $conflict } catch { $rejected = $_.Exception.Message -like '*Existing loader files*' }
if (!$rejected) { throw 'Conflicting loader was not rejected.' }
if ((Get-Content -LiteralPath "$conflict\winhttp.dll" -Raw) -ne 'keep-loader') { throw 'Conflicting loader changed.' }
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
