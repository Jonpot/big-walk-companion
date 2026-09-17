$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'GamePath.ps1')
$packageRoot = Split-Path $PSScriptRoot -Parent
$env:BIGWALK_PATH = Resolve-BigWalkPath ''
$env:COMPANION_DATA_DIR = Join-Path $packageRoot 'data'
$env:PORT = '4317'
$node = Join-Path $packageRoot 'runtime\node.exe'
$server = Join-Path $packageRoot 'companion\server.mjs'
try {
    $existing = Invoke-WebRequest 'http://127.0.0.1:4317/api/state' -UseBasicParsing -TimeoutSec 1
    if ($existing.StatusCode -eq 200) {
        Start-Process 'http://127.0.0.1:4317/'
        Write-Host 'A companion is already running. Close its window first to use this copy.'
        exit 0
    }
} catch {}
$browserJob = Start-Job -ScriptBlock {
    for ($attempt = 0; $attempt -lt 50; $attempt++) {
        try {
            $response = Invoke-WebRequest 'http://127.0.0.1:4317/api/state' -UseBasicParsing -TimeoutSec 1
            if ($response.StatusCode -eq 200) { Start-Process 'http://127.0.0.1:4317/'; return }
        } catch {}
        Start-Sleep -Milliseconds 200
    }
}
try {
    Write-Host 'Keep this window open while using the companion. Close it to stop.'
    & $node $server
    if ($LASTEXITCODE -ne 0) { throw 'The companion could not start. Check whether another copy is running.' }
} finally { Stop-Job $browserJob; Remove-Job $browserJob }
