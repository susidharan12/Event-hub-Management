@echo off
echo Starting EventHub Demo...
echo.

echo Starting Backend Server...
start "Backend Server" cmd /k "cd backend && npm start"

timeout /t 3 /nobreak >nul

echo Starting Frontend Server...
start "Frontend Server" cmd /k "node frontend-server.js"

timeout /t 3 /nobreak >nul

echo.
echo Demo servers started!
echo Backend API: http://localhost:3000
echo Frontend: http://localhost:8080
echo Organizer Dashboard: http://localhost:8080/organizer
echo.
echo Opening browser...
start http://localhost:8080/organizer

pause