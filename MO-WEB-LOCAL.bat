@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE="
for /f "delims=" %%I in ('where node.exe 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%I"

if not defined NODE_EXE if exist "F:\DEV\VSCode\node-v24.21.0-win-x64\node.exe" set "NODE_EXE=F:\DEV\VSCode\node-v24.21.0-win-x64\node.exe"

if not defined NODE_EXE (
  echo Khong tim thay Node.js. Hay cai Node.js 22 tro len.
  pause
  exit /b 1
)

"%NODE_EXE%" "scripts\open-local.mjs"
if errorlevel 1 (
  echo.
  echo Khong the mo website local. Xem log tai .sites-runtime\local\dev-server.log
  pause
  exit /b 1
)

endlocal
exit /b 0
