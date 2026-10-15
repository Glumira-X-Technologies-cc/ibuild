@echo off
rem One Builder. Builds the page, then server.js serves the page and the API on 3001.
rem When the GlumiraProxy service already answers on 3001, the new build is served at once: only the browser opens.
setlocal
set APP=%~dp0
set PB=%APP%..\..\Vaults\5-Production-Builder\Rows\5.13-Production-Builder\Books\Book-Production-Builder\Page-Prog-Production-Builder
cd /d "%APP%"
if not exist node_modules call npm ci --no-audit --no-fund
call npm run build
if errorlevel 1 exit /b 1
curl -s -o nul http://127.0.0.1:3001/health && (start http://127.0.0.1:3001/ & exit /b 0)
cd /d "%PB%"
if not exist node_modules call npm ci --omit=dev --no-audit --no-fund
set PORT=3001
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:3001/"
node server.js
