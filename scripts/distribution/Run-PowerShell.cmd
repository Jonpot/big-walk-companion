@echo off
setlocal
rem Prefer PowerShell 7, including the standard installation when PATH is missing it.
for /f "delims=" %%P in ('%SystemRoot%\System32\where.exe pwsh.exe 2^>nul') do (
    set "companionShell=%%P"
    goto run
)
if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" (
    set "companionShell=%ProgramFiles%\PowerShell\7\pwsh.exe"
    goto run
)
for /f "delims=" %%P in ('%SystemRoot%\System32\where.exe powershell.exe 2^>nul') do (
    set "companionShell=%%P"
    goto run
)
if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" (
    set "companionShell=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
    goto run
)
echo PowerShell was not found. Install PowerShell 7, then run this launcher again.
echo Download: https://aka.ms/powershell-release?tag=stable
exit /b 1
:run
echo Using "%companionShell%"
"%companionShell%" -NoProfile -ExecutionPolicy Bypass -File %*
exit /b %errorlevel%
