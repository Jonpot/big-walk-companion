$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$fixture = Join-Path $projectRoot ('.local\launcher test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixture -Force | Out-Null
$probe = Join-Path $fixture 'shell probe.ps1'
[IO.File]::WriteAllText($probe, 'param([string]$Value) Write-Output ("probe:{0}:{1}" -f $Value,$PSVersionTable.PSVersion.Major); exit 23')
$helper = Join-Path $PSScriptRoot 'distribution\Run-PowerShell.cmd'
function Test-Launcher([string]$SearchPath, [int]$Major) {
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = Join-Path $env:SystemRoot 'System32\cmd.exe'
    $info.Arguments = '/d /c ""' + $helper + '" "' + $probe + '" -Value "two words""'
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.EnvironmentVariables['PATH'] = $SearchPath
    $info.EnvironmentVariables['ProgramFiles'] = $fixture
    $process = [Diagnostics.Process]::Start($info)
    $output = $process.StandardOutput.ReadToEnd()
    $errors = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($process.ExitCode -ne 23 -or !$output.Contains("probe:two words:$Major")) { throw "Launcher failed: $output $errors" }
    $process.Dispose()
}
$pwsh = Get-Command pwsh.exe -ErrorAction SilentlyContinue
if ($pwsh) {
    Test-Launcher (Split-Path $pwsh.Source -Parent) 7
    Write-Output 'PASS: PowerShell 7 preference, quoted script/argument paths, exit-code propagation.'
}
Test-Launcher $fixture 5
Write-Output 'PASS: Windows PowerShell fallback with neither executable on PATH.'
