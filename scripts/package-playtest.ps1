param([string]$NodePath = '', [switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
if (!$NodePath) { $NodePath = (Get-Command node).Source }
if (!$SkipBuild) { & (Join-Path $PSScriptRoot 'build-mod.ps1') }
$nodeVersion = (& $NodePath --version).Trim()
$downloads = Join-Path $projectRoot '.local\downloads'
New-Item -ItemType Directory -Force -Path $downloads | Out-Null
$nodeLicense = Join-Path $downloads "node-$nodeVersion-LICENSE.txt"
if (!(Test-Path -LiteralPath $nodeLicense)) {
    Invoke-WebRequest "https://raw.githubusercontent.com/nodejs/node/$nodeVersion/LICENSE" -OutFile $nodeLicense
}
$bepLicense = Join-Path $downloads 'BepInEx-LICENSE.txt'
if (!(Test-Path -LiteralPath $bepLicense)) {
    Invoke-WebRequest 'https://raw.githubusercontent.com/BepInEx/BepInEx/5b766a3/LICENSE' -OutFile $bepLicense
}
$loaderName = 'BepInEx-Unity.IL2CPP-win-x64-6.0.0-be.788.zip'
$loaderArchive = Join-Path $downloads $loaderName
if (!(Test-Path -LiteralPath $loaderArchive)) { throw "Missing original verified loader archive: $loaderArchive" }
if ((Get-FileHash -LiteralPath $loaderArchive -Algorithm SHA256).Hash -ne 'F4CC496BD098A0DF4164B81E3737297707F13A47C2478DBA2F60EEFAB784817A') {
    throw 'The loader archive differs from the locally tested original download.'
}
$releaseRoot = Join-Path $projectRoot 'releases'
New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
$packageName = 'BigWalk-Companion-playtest-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
$stage = Join-Path $releaseRoot $packageName
if (Test-Path -LiteralPath $stage) { throw 'A build with this timestamp already exists.' }
foreach ($folder in @('companion', 'runtime', 'mod', 'installer', 'data\map-candidates', 'scripts', 'licenses')) {
    New-Item -ItemType Directory -Path (Join-Path $stage $folder) -Force | Out-Null
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'companion\dist') -Destination (Join-Path $stage 'companion') -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'companion\server.mjs') -Destination (Join-Path $stage 'companion')
Copy-Item -LiteralPath (Join-Path $projectRoot 'assets\map.png') -Destination (Join-Path $stage 'companion\map.png')
Copy-Item -LiteralPath $NodePath -Destination (Join-Path $stage 'runtime\node.exe')
Copy-Item -LiteralPath $nodeLicense -Destination (Join-Path $stage 'licenses\Node-LICENSE.txt')
Copy-Item -LiteralPath $bepLicense -Destination (Join-Path $stage 'licenses\BepInEx-LICENSE.txt')
& $NodePath (Join-Path $PSScriptRoot 'collect-web-licenses.mjs') (Join-Path $stage 'licenses\Browser-dependencies-LICENSE.txt')
if ($LASTEXITCODE -ne 0) { throw 'Browser dependency license collection failed.' }
Copy-Item -LiteralPath $loaderArchive -Destination (Join-Path $stage "installer\$loaderName")
Copy-Item -LiteralPath (Join-Path $projectRoot 'mod\BigWalk.Companion\bin\Release\net6.0\BigWalk.Companion.dll') -Destination (Join-Path $stage 'mod')
foreach ($name in @('Install.cmd', 'Start Companion.cmd', 'Collect Diagnostics.cmd', 'START HERE.txt')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "distribution\$name") -Destination $stage
}
foreach ($name in @('GamePath.ps1', 'Loader.ps1', 'Install.ps1', 'Start.ps1', 'Collect-Diagnostics.ps1', 'Run-PowerShell.cmd')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "distribution\$name") -Destination (Join-Path $stage 'scripts')
}
$sourcePack = Get-Content -LiteralPath (Join-Path $projectRoot 'data\route-pack.json') -Raw | ConvertFrom-Json
$cleanPack = @{revision=0; pack=@{version=1; name='Big Walk'; calibration=$sourcePack.pack.calibration; alignmentMethod=$sourcePack.pack.alignmentMethod; areas=@(); assets=@{}}}
[IO.File]::WriteAllText((Join-Path $stage 'data\route-pack.json'), ($cleanPack | ConvertTo-Json -Depth 15))
$manifest = foreach ($file in Get-ChildItem -LiteralPath $stage -Recurse -File) {
    @{path=$file.FullName.Substring($stage.Length + 1).Replace('\','/'); bytes=$file.Length; sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash}
}
[IO.File]::WriteAllText((Join-Path $stage 'manifest.json'), (@{createdUtc=[DateTime]::UtcNow.ToString('o'); node=$nodeVersion; files=@($manifest)} | ConvertTo-Json -Depth 6))
$archive = Join-Path $releaseRoot "$packageName.zip"
Compress-Archive -LiteralPath $stage -DestinationPath $archive -CompressionLevel Optimal
$hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
[IO.File]::WriteAllText(($archive + '.sha256'), "$hash  $packageName.zip")
Write-Output "Package: $archive"
Write-Output "SHA256: $hash"
Write-Output "Staging folder: $stage"
