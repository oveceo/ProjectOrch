@echo off
REM ============================================================================
REM EO WBS Task Manager - Enterprise Startup Script
REM Ohio Valley Electric Corporation
REM ============================================================================

title EO WBS Task Manager Server

echo.
echo ============================================================================
echo   EO WBS Task Manager - Enterprise Server
echo   Ohio Valley Electric Corporation
echo ============================================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

REM Display Node.js version
echo Node.js version:
node --version
echo.

REM Change to script directory
cd /d "%~dp0"
echo Working directory: %CD%
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    echo This may take a few minutes on first run.
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
)

REM Check if .env.local exists
if not exist ".env.local" (
    echo WARNING: .env.local not found!
    echo.
    echo Please create .env.local with the following required variables:
    echo   - DATABASE_URL
    echo   - NEXTAUTH_SECRET
    echo   - SMARTSHEET_ACCESS_TOKEN
    echo.
    echo See env.example for a complete list of configuration options.
    echo.
    pause
    exit /b 1
)

REM Generate Prisma client if needed
if not exist "node_modules\.prisma" (
    echo Generating Prisma client...
    call npx prisma generate
    if %ERRORLEVEL% NEQ 0 (
        echo WARNING: Prisma generation failed - database features may not work
    )
    echo.
)

REM Check database connection
echo Checking database connection...
call npx prisma db push --accept-data-loss >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Database connection may not be configured correctly
    echo The application will start but database features may not work
    echo.
)

echo.
echo ============================================================================
echo   Starting EO WBS Task Manager...
echo   The server will be available at http://localhost:3005
echo.
echo   Press Ctrl+C to stop the server
echo ============================================================================
echo.

REM Start the development server
call npm run dev

REM If we get here, the server stopped
echo.
echo Server stopped.
pause

