@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title DUKE$DEFENSE - same WiFi

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js was not found. Install it from https://nodejs.org then retry.
  pause
  exit /b 1
)

echo.
echo   ===================================================
echo    DUKE$DEFENSE  -  same-WiFi co-op
echo   ===================================================
echo.
echo   Everyone on THIS WiFi opens the "Network" address
echo   printed below. Only works for people in the house /
echo   on the same router. For a far-away friend, use
echo   PLAY-ONLINE.cmd instead.
echo.

node server.js

pause
