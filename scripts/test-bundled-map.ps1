# Run with PowerShell 7 after building the plugin. No game or Unity runtime is loaded.
param([string]$PluginPath)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
if (!$PluginPath) { $PluginPath = Join-Path $projectRoot 'mod\BigWalk.Companion\bin\Release\net6.0\BigWalk.Companion.dll' }
$assembly = [Reflection.Assembly]::LoadFile((Resolve-Path -LiteralPath $PluginPath).Path)
if ($assembly.GetReferencedAssemblies().Name -contains 'UnityEngine.ImageConversionModule') { throw 'The crash-prone image conversion dependency remains.' }
$method = $assembly.GetType('BigWalk.Companion.BundledMap', $true).GetMethod('WriteIfMissing')
$writeMap = $method.CreateDelegate([Func[string,bool]])
$fixture = Join-Path $projectRoot ('.local\bundled-map-test-' + [Guid]::NewGuid().ToString('N'))
$targetFolder = Join-Path $fixture 'new profile [test]\companion'
if (!$writeMap.Invoke($targetFolder)) { throw 'Fresh map was not written.' }
$image = Join-Path $targetFolder 'map.png'
if ((Get-FileHash -LiteralPath $image).Hash -ne (Get-FileHash -LiteralPath (Join-Path $projectRoot 'assets\map.png')).Hash) { throw 'Embedded PNG differs from the calibrated map.' }
$modified = (Get-Item -LiteralPath $image).LastWriteTimeUtc
if ($writeMap.Invoke($targetFolder)) { throw 'Existing map was replaced.' }
if ((Get-Item -LiteralPath $image).LastWriteTimeUtc -ne $modified) { throw 'Existing map was rewritten.' }
[IO.File]::WriteAllText($image, 'user-map-fixture')
if ($writeMap.Invoke($targetFolder) -or [IO.File]::ReadAllText($image) -ne 'user-map-fixture') { throw 'User map was overwritten.' }
$blocked = Join-Path $fixture 'file-not-folder'
[IO.File]::WriteAllText($blocked, 'keep-me')
$failed = $false
try { $writeMap.Invoke($blocked) | Out-Null } catch { $failed = $true }
if (!$failed -or [IO.File]::ReadAllText($blocked) -ne 'keep-me') { throw 'Write failure did not preserve existing data.' }
if (@(Get-ChildItem -LiteralPath $targetFolder -Filter '*.tmp').Count) { throw 'Temporary file left behind.' }
Write-Output 'PASS: actual plugin resource matches calibrated map; fresh write without game/save, existing map preservation, failure handling, no ImageConversion dependency.'
