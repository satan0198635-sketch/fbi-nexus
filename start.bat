@echo off
chcp 65001 >nul
cd /d "%~dp0"
title A-140 Federal Operations System

where node >nul 2>nul
if %errorlevel%==0 (
  echo [A-140] Starting with Node.js on http://localhost:3000
  start "" http://localhost:3000
  node server.js
) else (
  echo [A-140] Node.js not found - starting built-in preview server on http://localhost:3000
  start "" http://localhost:3000
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve.ps1" -Port 3000
)
pause
