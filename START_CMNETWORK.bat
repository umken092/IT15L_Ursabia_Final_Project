@echo off
REM CMNetwork ERP - Quick Start Script
REM This script starts both the backend (.NET API) and frontend (React + Vite)

echo.
echo ================================================
echo   CMNetwork ERP - Full Stack Development Setup
echo ================================================
echo.

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "BACKEND_PROJECT=%SCRIPT_DIR%src\CMNetwork.WebApi\CMNetwork.WebApi.csproj"
set "FRONTEND_DIR=%SCRIPT_DIR%src\CMNetwork.ClientApp"

REM ------------------------------------------------------------------
REM Check if backend is already running on port 5128.
REM Uses two findstr passes with plain strings - no regex, no for/f pipe.
REM ------------------------------------------------------------------
set "BACKEND_RUNNING="
netstat -ano 2>nul | findstr /C:":5128" | findstr /C:"LISTENING" >nul 2>&1
if not errorlevel 1 set "BACKEND_RUNNING=1"

REM -- Backend --
if defined BACKEND_RUNNING (
    echo [1/2] Backend already running on port 5128. Skipping backend startup.
    echo        URL: http://localhost:5128/api
    echo.
) else (
    echo [1/2] Starting Backend ^(.NET API^)...
    echo        URL: http://localhost:5128/api
    echo.
    start "CMNetwork Backend" cmd /k "cd /d "%SCRIPT_DIR%" && dotnet run --launch-profile http --project "%BACKEND_PROJECT%""
    timeout /t 3 /nobreak >nul
)

REM -- Frontend --
echo [2/2] Starting Frontend ^(React + Vite^)...
echo        URL: http://localhost:5173/
echo.
start "CMNetwork Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

echo.
echo ================================================
echo   Both services are starting...
echo   Backend:  http://localhost:5128/api
echo   Frontend: http://localhost:5173/
echo ================================================
echo.
echo   Two windows should open shortly.
echo   Close either window to stop that service.
echo.
pause
