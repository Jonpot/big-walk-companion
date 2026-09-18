@echo off
cd /d "%~dp0"
node companion\launch.mjs --stop
if errorlevel 1 pause
