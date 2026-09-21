@echo off
setlocal

cd /d "%~dp0"
set "LOCAL_URL=http://localhost:5173/"
set "NODE_EXE=F:\DEV\VSCode\node-v24.21.0-win-x64\node.exe"

if not exist "%NODE_EXE%" set "NODE_EXE=C:\Users\ADMIN\AppData\Local\Temp\codex-node-v22.23.2\node-v22.23.2-win-x64\node.exe"

if not exist "%NODE_EXE%" (
  echo Khong tim thay Node.js de khoi dong website.
  echo Hay cai Node.js hoac cap nhat duong dan NODE_EXE trong file nay.
  pause
  exit /b 1
)

powershell.exe -NoProfile -Command "if (Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo Dang khoi dong website local...
  start "ROOMXAYDUNG dev server" /min "%NODE_EXE%" "%~dp0scripts\run-framework.mjs" dev
)

echo Dang cho website san sang...
powershell.exe -NoProfile -Command "$url='%LOCAL_URL%'; for ($i=0; $i -lt 60; $i++) { try { $response=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 1"
if errorlevel 1 (
  echo Khong the mo website tai %LOCAL_URL%
  echo Kiem tra cua so dev server de xem loi.
  pause
  exit /b 1
)

start "" "%LOCAL_URL%"
exit /b 0
