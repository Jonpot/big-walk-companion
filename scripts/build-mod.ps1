param([string]$GamePath = 'C:\Program Files (x86)\Steam\steamapps\common\Big Walk', [switch]$Install)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$sdk = Join-Path $projectRoot '.local\dotnet\dotnet.exe'
if (!(Test-Path -LiteralPath $sdk)) { $sdk = 'dotnet' }
& $sdk build (Join-Path $projectRoot 'mod\BigWalk.Companion\BigWalk.Companion.csproj') -c Release "-p:GamePath=$GamePath"
if ($LASTEXITCODE -ne 0) { throw 'Plugin build failed.' }
if ($Install) {
    if (Get-Process 'Big Walk' -ErrorAction SilentlyContinue) { throw 'Close Big Walk before installing the plugin.' }
    $destination = Join-Path $GamePath 'BepInEx\plugins\BigWalk.Companion'
    New-Item -ItemType Directory -Force $destination | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot 'mod\BigWalk.Companion\bin\Release\net6.0\BigWalk.Companion.dll') -Destination $destination
    Write-Output "Installed companion plugin in $destination"
}
