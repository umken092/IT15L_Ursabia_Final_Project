# CMNetwork ERP - Quick Start Script (PowerShell)
# This script starts both the backend (.NET API) and frontend (React + Vite)

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   CMNetwork ERP - Full Stack Development Setup" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$backendProject = Join-Path $rootDir "src\CMNetwork.WebApi\CMNetwork.WebApi.csproj"
$frontendDir = Join-Path $rootDir "src\CMNetwork.ClientApp"
$backendJob = $null

# Check if npm is installed
$npmPath = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmPath) {
    Write-Host "ERROR: npm is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if dotnet is installed
$dotnetPath = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnetPath) {
    Write-Host "ERROR: dotnet is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install .NET SDK from https://dotnet.microsoft.com/download" -ForegroundColor Yellow
    exit 1
}

$backendRunning = $null -ne (netstat -ano | Select-String ':5128\s+.*LISTENING')

if ($backendRunning) {
    Write-Host "[1/2] Backend already running on port 5128. Skipping backend startup." -ForegroundColor Yellow
    Write-Host "        URL: http://localhost:5128/api" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "[1/2] Starting Backend (.NET API)..." -ForegroundColor Green
    Write-Host "        URL: http://localhost:5128/api" -ForegroundColor Yellow
    Write-Host ""

    # Start backend in a new PowerShell window
    $backendScript = @"
try {
    Set-Location "$rootDir"
    Write-Host "Backend server starting..." -ForegroundColor Green
    dotnet run --launch-profile http --project "$backendProject"
} catch {
    Write-Host "Error starting backend: `$_" -ForegroundColor Red
}
"@

    $backendJob = Start-Process PowerShell -ArgumentList "-NoExit", "-Command", $backendScript -PassThru

    # Wait for backend to start
    Start-Sleep -Seconds 3
}

Write-Host "[2/2] Starting Frontend (React + Vite)..." -ForegroundColor Green
Write-Host "        URL: http://localhost:5173/" -ForegroundColor Yellow
Write-Host ""

# Start frontend in another PowerShell window
$frontendScript = @"
try {
    Set-Location "$frontendDir"
    Write-Host "Frontend dev server starting..." -ForegroundColor Green
    npm run dev
} catch {
    Write-Host "Error starting frontend: `$_" -ForegroundColor Red
}
"@

$frontendJob = Start-Process PowerShell -ArgumentList "-NoExit", "-Command", $frontendScript -PassThru

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   Both services are starting..." -ForegroundColor Cyan
Write-Host "   Backend:  http://localhost:5128/api" -ForegroundColor Yellow
Write-Host "   Frontend: http://localhost:5173/" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Two terminal windows should open shortly." -ForegroundColor White
Write-Host "Close either window to stop that service." -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to close all services..." -ForegroundColor Gray
Write-Host ""

# Keep main window open and handle cleanup
try {
    while ($true) {
        if ($backendJob -and -not (Get-Process -Id $backendJob.Id -ErrorAction SilentlyContinue)) {
            Write-Host "Backend process has stopped." -ForegroundColor Yellow
        }
        if (-not (Get-Process -Id $frontendJob.Id -ErrorAction SilentlyContinue)) {
            Write-Host "Frontend process has stopped." -ForegroundColor Yellow
        }
        Start-Sleep -Seconds 2
    }
} catch {
    # Cleanup on exit
    if ($backendJob) {
        Stop-Process -Id $backendJob.Id -Force -ErrorAction SilentlyContinue
    }
    Stop-Process -Id $frontendJob.Id -Force -ErrorAction SilentlyContinue
}
