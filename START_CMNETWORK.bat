@echo off
REM CMNetwork ERP - Quick Start Script
REM This script starts both the backend (.NET API) and frontend (React + Vite)

echo.
echo ================================================
echo   CMNetwork ERP - Full Stack Development Setup
echo ================================================
echo.

REM Get the directory where this script is located
setlocal enabledelayedexpansion
set SCRIPT_DIR=%~dp0

REM Backend setup
echo [1/2] Starting Backend (.NET API)...
echo        URL: https://localhost:7288/api
echo.
start "CMNetwork Backend" cmd /k "cd /d %SCRIPT_DIR% && dotnet run"

REM Give backend time to start
timeout /t 3 /nobreak

REM Frontend setup
echo [2/2] Starting Frontend (React + Vite)...
echo        URL: http://localhost:5173/
echo.
start "CMNetwork Frontend" cmd /k "cd /d %SCRIPT_DIR%cmnetwork-erp && npm run dev"

echo.
echo ================================================
echo   Both services are starting...
echo   Backend:  https://localhost:7288/api
echo   Frontend: http://localhost:5173/
echo ================================================
echo.
echo   Two terminal windows should open shortly.
echo   Close either window to stop that service.
echo.
pause
