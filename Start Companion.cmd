@echo off
cd /d "%~dp0"
echo Big Walk companion: http://127.0.0.1:4317
echo Keep this window open while using the companion.
node companion\server.mjs
pause
