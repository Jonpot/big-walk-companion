$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
& node (Join-Path $projectRoot 'companion\launch.mjs')
