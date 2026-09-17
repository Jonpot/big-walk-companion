@echo off
cd /d "%~dp0"
call "%~dp0scripts\Run-PowerShell.cmd" "%~dp0scripts\Install.ps1" -Launch -Interactive %*
set "companionExit=%errorlevel%"
pause
exit /b %companionExit%
