@echo off
setlocal enabledelayedexpansion

REM ═══════════════════════════════════════════════════════════════════
REM EventHub Docker Compose Startup Script for Windows
REM ═══════════════════════════════════════════════════════════════════

cls
echo.
echo ═══════════════════════════════════════════════════════════════════
echo     EventHub Docker Compose Startup Script
echo ═══════════════════════════════════════════════════════════════════
echo.

REM Check if Docker is installed
where docker >nul 2>nul
if errorlevel 1 (
    echo ✗ Docker is not installed!
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo ✓ Docker is installed
echo.

REM Check .env file
if not exist ".env" (
    echo ⚠ .env file not found, creating...
    if exist ".env.example" (
        copy .env.example .env
        echo ✓ Created .env from .env.example
    ) else (
        echo ⚠ No .env.example found - using defaults
    )
) else (
    echo ✓ .env file exists
)
echo.

:menu
cls
echo ═══════════════════════════════════════════════════════════════════
echo EventHub Docker Compose - Main Menu
echo ═══════════════════════════════════════════════════════════════════
echo.
echo 1. Start all services (Backend + AI + Payment + DB + Frontend)
echo 2. Start backend only (PostgreSQL + Backend + Frontend)
echo 3. Stop all services
echo 4. View service logs
echo 5. Remove all containers and volumes (WARNING: data loss!)
echo 6. Check service health
echo 7. Exit
echo.
set /p choice="Enter your choice (1-7): "
echo.

if "%choice%"=="1" (
    cls
    echo Starting all services...
    echo Building: PostgreSQL, Backend, AI Service, Payment Service, Frontend
    echo.

    docker-compose down --remove-orphans
    timeout /t 2 /nobreak
    echo.

    docker-compose up -d --build

    echo.
    echo ✓ All services starting...
    echo.
    timeout /t 5 /nobreak

    echo Service URLs:
    echo   Frontend:           http://localhost:5050
    echo   Backend API:        http://localhost:3000
    echo   API Documentation:  http://localhost:3000/api-docs
    echo   AI Service:         http://localhost:8080
    echo   Payment Service:    http://localhost:8081
    echo   PostgreSQL:         localhost:5432
    echo.
    echo View logs with:
    echo   docker-compose logs -f        [all services]
    echo   docker-compose logs -f backend [backend only]
    echo   docker-compose logs -f ai     [ai service only]
    echo   docker-compose logs -f payment [payment service only]
    echo.
    pause
    goto menu
)

if "%choice%"=="2" (
    cls
    echo Starting backend stack (no AI/Payment services)...
    echo Starting: PostgreSQL, Backend, Frontend
    echo.

    docker-compose down --remove-orphans
    timeout /t 2 /nobreak
    echo.

    docker-compose up -d --build db backend frontend

    echo.
    echo ✓ Backend services starting...
    echo.

    echo Service URLs:
    echo   Frontend:           http://localhost:5050
    echo   Backend API:        http://localhost:3000
    echo   API Documentation:  http://localhost:3000/api-docs
    echo   PostgreSQL:         localhost:5432
    echo.
    echo Note: AI and Payment services are NOT running
    echo.
    pause
    goto menu
)

if "%choice%"=="3" (
    cls
    echo Stopping all services...
    docker-compose down
    echo.
    echo ✓ All services stopped
    echo.
    pause
    goto menu
)

if "%choice%"=="4" (
    cls
    echo Showing logs for all services...
    echo Press Ctrl+C to exit
    echo.
    docker-compose logs -f
    echo.
    pause
    goto menu
)

if "%choice%"=="5" (
    cls
    echo WARNING: This will delete all data!
    set /p confirm="Are you sure? Type 'yes' to confirm: "

    if /i "%confirm%"=="yes" (
        echo Removing all containers and volumes...
        docker-compose down -v
        echo ✓ All containers and volumes removed
    ) else (
        echo Cancelled
    )
    echo.
    pause
    goto menu
)

if "%choice%"=="6" (
    cls
    echo Checking service health...
    echo.

    echo Checking services...
    docker-compose ps
    echo.
    pause
    goto menu
)

if "%choice%"=="7" (
    exit /b 0
)

goto menu
