@echo off
REM EventHub NgROK Backend Setup Script for Windows
REM This script helps you set up and start ngrok tunneling

setlocal enabledelayedexpansion

echo.
echo =========================================
echo EventHub NgROK Setup Script
echo =========================================
echo.

REM Check if ngrok is installed
where ngrok >nul 2>nul
if errorlevel 1 (
    echo [ERROR] ngrok is not installed or not in PATH
    echo.
    echo Please install ngrok:
    echo - Download from https://ngrok.com/download
    echo - Or use: choco install ngrok
    echo.
    pause
    exit /b 1
)

echo [OK] ngrok found:
ngrok version
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed
    pause
    exit /b 1
)

echo [OK] Node.js found
node --version
echo.

REM Ask user for their choices
echo What would you like to do?
echo 1 - Start ngrok tunnel for backend (port 3000)
echo 2 - Start ngrok for both backend and frontend
echo 3 - Show ngrok tunnel info
echo 4 - Stop ngrok
echo.
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" (
    echo.
    echo Starting ngrok tunnel for backend...
    echo.
    ngrok http 3000 --config=backend\ngrok.yml --tunnel-name=eventhub-backend
)

if "%choice%"=="2" (
    echo.
    echo Starting ngrok tunnels for backend and frontend...
    echo.
    ngrok start --config=backend\ngrok.yml eventhub-backend eventhub-frontend
)

if "%choice%"=="3" (
    echo.
    echo NgROK tunnel information:
    echo.
    ngrok api tunnels list
)

if "%choice%"=="4" (
    echo.
    echo Stopping all ngrok tunnels...
    echo.
    ngrok stop
)

pause
