@echo off
REM ============================================================================
REM EO WBS Task Manager - Production Build Script
REM Ohio Valley Electric Corporation
REM ============================================================================

title EO WBS Task Manager - Production Build

echo.
echo ============================================================================
echo   EO WBS Task Manager - Production Build
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

REM Change to script directory
cd /d "%~dp0"
echo Working directory: %CD%
echo.

REM Clean previous build
echo Cleaning previous build...
if exist ".next" rmdir /s /q ".next"
echo.

REM Install dependencies
echo Installing dependencies...
call npm ci --production=false
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo.

REM Generate Prisma client
echo Generating Prisma client...
call npx prisma generate
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to generate Prisma client
    pause
    exit /b 1
)
echo.

REM Run type check
echo Running TypeScript type check...
call npm run type-check
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: TypeScript errors found - continuing anyway
)
echo.

REM Run linting
echo Running ESLint...
call npm run lint
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Linting errors found - continuing anyway
)
echo.

REM Build for production
echo Building for production...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Production build failed
    pause
    exit /b 1
)
echo.

echo ============================================================================
echo   BUILD COMPLETE!
echo.
echo   To start the production server:
echo     npm run start
echo.
echo   Or use: start-production.bat
echo ============================================================================
echo.
pause

