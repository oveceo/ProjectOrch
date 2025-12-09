@echo off
setlocal

echo ==========================================
echo  Transmission WBS Task Manager - Backend Server
echo ==========================================
echo.

:: Get this computer's IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| find "IPv4"') do (
    set "IP=%%a"
    goto :found_ip
)
:found_ip
set "IP=%IP: =%"

set "PORT=3005"

echo Starting backend server...
echo.
echo ==========================================
echo  Server Information
echo ==========================================
echo  Local URL:    http://localhost:%PORT%
echo  Network URL:  http://%IP%:%PORT%
echo ==========================================
echo.
echo Share this URL with your team:
echo   http://%IP%:%PORT%/wbs
echo.
echo Keep this window open while the server is running.
echo Press Ctrl+C to stop the server.
echo.

cd /d "%~dp0"
set NODE_ENV=production
set PORT=%PORT%

:: Start the server
npm run start

pause

