# Exercises the actual compiled launcher against a harmless Node fixture, never the game.
param([string]$PluginPath, [string]$NodePath)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
if (!$PluginPath) { $PluginPath = Join-Path $projectRoot 'mod\BigWalk.Companion\bin\Release\net6.0\BigWalk.Companion.dll' }
if (!$NodePath) { $NodePath = (Get-Command node.exe).Source }
$fixture = Join-Path $projectRoot ('.local\mod launcher [test]-' + [Guid]::NewGuid().ToString('N'))
foreach ($folder in @('runtime','companion','custom notes')) { [IO.Directory]::CreateDirectory((Join-Path $fixture $folder)) | Out-Null }
Copy-Item -LiteralPath $NodePath -Destination (Join-Path $fixture 'runtime\node.exe')
[IO.File]::WriteAllText((Join-Path $fixture 'companion\launch.mjs'), @'
import fs from 'node:fs';
import path from 'node:path';
fs.writeFileSync(path.join(process.env.COMPANION_DATA_DIR,'probe.json'),JSON.stringify({
  game:process.env.BIGWALK_PATH,telemetry:process.env.COMPANION_TELEMETRY_DIR,
  port:process.env.PORT,browser:process.env.COMPANION_OPEN_BROWSER,cwd:process.cwd()
}));
'@)
$registration = Join-Path $fixture 'registration.json'
$game = Join-Path $fixture 'game folder'
$telemetry = Join-Path $fixture 'profile [one]\companion'
[IO.File]::WriteAllText($registration, (@{packageRoot=$fixture;gamePath=$game;dataDirectory=(Join-Path $fixture 'custom notes')}|ConvertTo-Json))
$assembly = [Reflection.Assembly]::LoadFile((Resolve-Path -LiteralPath $PluginPath).Path)
$launch = $assembly.GetType('BigWalk.Companion.CompanionLauncher',$true).GetMethod('Start').CreateDelegate([Action[string,string]])
$launch.Invoke($registration,$telemetry)
$probePath = Join-Path $fixture 'custom notes\probe.json'
for ($attempt=0; $attempt -lt 50 -and !(Test-Path -LiteralPath $probePath); $attempt++) { Start-Sleep -Milliseconds 100 }
$probe = Get-Content -LiteralPath $probePath -Raw | ConvertFrom-Json
if ($probe.game -ne $game -or $probe.telemetry -ne $telemetry -or $probe.port -ne '4317' -or $probe.browser -ne '1' -or $probe.cwd -ne $fixture) { throw 'Compiled launcher used incorrect paths or settings.' }
$rejected = $false
try { $launch.Invoke((Join-Path $fixture 'missing-registration.json'),$telemetry) } catch { $rejected = $_.Exception.ToString().Contains('Run Install.cmd') }
if (!$rejected) { throw 'Missing launch registration was not explained.' }
[IO.File]::WriteAllText($registration, (@{packageRoot=(Join-Path $fixture 'moved');gamePath=$game}|ConvertTo-Json))
$rejected = $false
try { $launch.Invoke($registration,$telemetry) } catch { $rejected = $_.Exception.ToString().Contains('moved or is incomplete') }
if (!$rejected) { throw 'Moved package was not detected.' }
Write-Output 'PASS: compiled mod launches Node with spaced/bracketed paths, correct game/profile/data, browser option, and actionable missing/moved-package errors.'
