@echo off
title GrideX
cd /d "%~dp0"
echo Starting GrideX... keep this window open.
start "" /min cmd /c "timeout /t 2 >nul & start http://localhost:3000"
node server.js
pause
