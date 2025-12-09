@echo off
REM ============================================================================
REM EO WBS Task Manager - Production Server Startup
REM Ohio Valley Electric Corporation
REM ============================================================================

title EO WBS Task Manager - Production Server

echo.
echo ============================================================================
echo   EO WBS Task Manager - Production Server
echo   Ohio Valley Electric Corporation
echo ============================================================================
echo.

REM Change to script directory
cd /d "%~dp0"

REM Check if .next folder exists (production build)
if not exist ".next" (
    echo ERROR: Production build not found!
    echo Please run build-production.bat first.
    pause
    exit /b 1
)

REM Check if .env.local exists
if not exist ".env.local" (
    echo ERROR: .env.local not found!
    echo Please configure environment variables before starting.
    pause
    exit /b 1
)

echo Starting production server on port 3005...
echo Server will be available at http://localhost:3005
echo.
echo Press Ctrl+C to stop the server
echo.

REM Set production environment
set NODE_ENV=production

REM Start the production server
call npm run start

pause

