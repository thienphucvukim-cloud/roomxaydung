@echo off
setlocal

cd /d "%~dp0"
set "LOCAL_URL=http://localhost:5173/"
set "NODE_EXE=C:\Users\ADMIN\AppData\Local\Temp\codex-node-v22.23.2\node-v22.23.2-win-x64\node.exe"

rem Node 22 is used because Node 24 can hang while Vinext scans dependencies.
if not exist "%NODE_EXE%" (
  set "NODE_EXE="
  for /f "delims=" %%I in ('where.exe node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%I"
)

if not defined NODE_EXE (
  echo Khong tim thay Node.js.
  echo Hay cai Node.js 22 LTS, sau do bam lai file nay.
  pause
  exit /b 1
)

powershell.exe -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri '%LOCAL_URL%' -TimeoutSec 2; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo Dang khoi dong website local...
  start "ROOMXAYDUNG dev server" /min "%NODE_EXE%" "%~dp0scripts\run-framework.mjs" dev
)

echo Dang cho website san sang...
powershell.exe -NoProfile -Command "$url='%LOCAL_URL%'; for ($i=0; $i -lt 120; $i++) { try { $r=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 1"
if errorlevel 1 (
  echo Khong the khoi dong website tai %LOCAL_URL%
  echo Hay xem cua so ROOMXAYDUNG dev server de biet loi.
  pause
  exit /b 1
)

echo Dang mo website...
start "" "%LOCAL_URL%"
exit /b 0
