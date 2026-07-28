@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title DUKE$DEFENSE - online co-op

echo.
echo   ===================================================
echo    DUKE$DEFENSE  -  online co-op launcher
echo   ===================================================
echo.

REM --- 1. make sure Node is available -------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js was not found on this PC.
  echo   Install it from https://nodejs.org  then run this again.
  echo.
  pause
  exit /b 1
)

REM --- 2. get cloudflared once (official Cloudflare download) --------
if not exist "cloudflared.exe" (
  echo   First run only: downloading Cloudflare's tunnel tool ^(~35 MB^)...
  powershell -NoProfile -Command "try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe' } catch { Write-Host $_.Exception.Message; exit 1 }"
  if not exist "cloudflared.exe" (
    echo.
    echo   Could not download the tunnel tool. Check your internet and retry.
    pause
    exit /b 1
  )
  echo   Done.
  echo.
)

REM --- 3. start the game server in its own window -------------------
echo   Starting the game server...
start "DUKE$DEFENSE server" cmd /k "node server.js"

REM give it a second to bind the port
timeout /t 2 /nobreak >nul

echo.
echo   ---------------------------------------------------
echo    Creating your public link. In a moment you'll see
echo    a line like:
echo.
echo        https://SOMETHING.trycloudflare.com
echo.
echo    ^>^>  THAT is the link. Send it to your friend.  ^<^<
echo.
echo    Both of you open it, tap CO-OP, one HOSTS and
echo    shares the room code, the other JOINS.
echo.
echo    Keep THIS window (and the server window) open
echo    while you play. Close them when you're done.
echo   ---------------------------------------------------
echo.

REM --- 4. open the public tunnel (prints the link, stays running) ---
cloudflared.exe tunnel --url http://localhost:8177

echo.
echo   Tunnel closed. You can close this window.
pause
