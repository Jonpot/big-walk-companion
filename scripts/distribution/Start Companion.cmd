@echo off
cd /d "%~dp0"
call "%~dp0scripts\Run-PowerShell.cmd" "%~dp0scripts\Start.ps1" %*
set "companionExit=%errorlevel%"
if errorlevel 1 pause
exit /b %companionExit%
