@echo off
cd /d "%~dp0"
call "%~dp0scripts\Run-PowerShell.cmd" "%~dp0scripts\Collect-Diagnostics.ps1" %*
set "companionExit=%errorlevel%"
pause
exit /b %companionExit%
