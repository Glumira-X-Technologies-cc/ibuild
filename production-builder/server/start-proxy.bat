@echo off
rem GluMira local proxy, no admin needed. Keep this window open while you use it.
cd /d "%~dp0"
if not exist node_modules\express (
  echo Installing Express once...
  call npm install --omit=dev || goto :fail
)
node server.js
goto :eof
:fail
echo npm install failed. Is Node.js installed?
pause
