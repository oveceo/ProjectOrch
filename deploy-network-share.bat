@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo  Transmission WBS Task Manager - Network Share Deployment
echo ==========================================
echo.

:: Get current directory
set "SOURCE_DIR=%~dp0"

:: Ask for network share path
set /p "SHARE_PATH=Enter the network share path (e.g., \\server\share\TransmissionWBS): "

:: Ask for backend host IP
set /p "BACKEND_HOST=Enter your computer's IP address for the backend (e.g., 192.168.1.100): "

:: Set default port
set "BACKEND_PORT=3005"
set /p "BACKEND_PORT=Enter backend port [%BACKEND_PORT%]: "
if "%BACKEND_PORT%"=="" set "BACKEND_PORT=3005"

echo.
echo Configuration:
echo   Source: %SOURCE_DIR%
echo   Target: %SHARE_PATH%
echo   Backend: http://%BACKEND_HOST%:%BACKEND_PORT%
echo.

:: Create target directory
if not exist "%SHARE_PATH%" (
    echo Creating network share directory...
    mkdir "%SHARE_PATH%"
)

:: Build the production version first
echo.
echo Building production version...
call npm run build

if errorlevel 1 (
    echo Build failed! Please check for errors.
    pause
    exit /b 1
)

:: Create the network share structure
echo.
echo Copying files to network share...

:: Copy the built .next folder and required files
robocopy "%SOURCE_DIR%.next" "%SHARE_PATH%\.next" /E /NFL /NDL /NJH /NJS
robocopy "%SOURCE_DIR%public" "%SHARE_PATH%\public" /E /NFL /NDL /NJH /NJS
robocopy "%SOURCE_DIR%node_modules" "%SHARE_PATH%\node_modules" /E /NFL /NDL /NJH /NJS

:: Copy essential config files
copy "%SOURCE_DIR%package.json" "%SHARE_PATH%\" /Y >nul
copy "%SOURCE_DIR%next.config.js" "%SHARE_PATH%\" /Y >nul

:: Create the launcher batch file for users
echo Creating user launcher...
(
echo @echo off
echo echo Starting Transmission WBS Task Manager...
echo echo Connecting to backend at http://%BACKEND_HOST%:%BACKEND_PORT%
echo echo.
echo echo Please wait while the application loads...
echo start "" "http://%BACKEND_HOST%:%BACKEND_PORT%/wbs"
echo timeout /t 2 /nobreak ^>nul
) > "%SHARE_PATH%\Launch-TransmissionWBS.bat"

:: Create the backend starter for the host
echo Creating backend starter for host machine...
(
echo @echo off
echo setlocal
echo echo ==========================================
echo echo  Transmission WBS Task Manager - Backend Server
echo echo ==========================================
echo echo.
echo echo Starting backend server on port %BACKEND_PORT%...
echo echo Other users can access via: http://%BACKEND_HOST%:%BACKEND_PORT%
echo echo.
echo cd /d "%SOURCE_DIR%"
echo set NODE_ENV=production
echo set PORT=%BACKEND_PORT%
echo npm run start
echo pause
) > "%SOURCE_DIR%\start-backend-server.bat"

:: Create instructions file
echo Creating instructions...
(
echo Transmission WBS Task Manager - Network Share Setup
echo ====================================================
echo.
echo FOR THE HOST MACHINE ^(where the backend runs^):
echo -------------------------------------------------
echo 1. Run "start-backend-server.bat" in %SOURCE_DIR%
echo 2. Keep this window open - it runs the backend server
echo 3. Your IP address: %BACKEND_HOST%
echo 4. Backend URL: http://%BACKEND_HOST%:%BACKEND_PORT%
echo.
echo IMPORTANT: The backend server must be running for others to use the app!
echo.
echo.
echo FOR OTHER USERS ^(accessing via network share^):
echo -------------------------------------------------
echo 1. Open the network share: %SHARE_PATH%
echo 2. Double-click "Launch-TransmissionWBS.bat"
echo 3. The app will open in your default browser
echo.
echo.
echo TROUBLESHOOTING:
echo -------------------------------------------------
echo - If the app doesn't load, check that the backend server is running
echo - Make sure your firewall allows connections on port %BACKEND_PORT%
echo - Verify the host IP address is correct: %BACKEND_HOST%
echo.
echo.
echo FIREWALL SETUP ^(run on host machine as Administrator^):
echo -------------------------------------------------
echo netsh advfirewall firewall add rule name="Transmission WBS" dir=in action=allow protocol=tcp localport=%BACKEND_PORT%
echo.
) > "%SHARE_PATH%\README-Setup.txt"

echo.
echo ==========================================
echo  Deployment Complete!
echo ==========================================
echo.
echo Network share: %SHARE_PATH%
echo Backend URL: http://%BACKEND_HOST%:%BACKEND_PORT%
echo.
echo Next steps:
echo 1. Run "start-backend-server.bat" on this machine to start the backend
echo 2. Share "%SHARE_PATH%" with your users
echo 3. Users can double-click "Launch-TransmissionWBS.bat" to access the app
echo.
echo IMPORTANT: Add firewall rule to allow port %BACKEND_PORT%:
echo netsh advfirewall firewall add rule name="Transmission WBS" dir=in action=allow protocol=tcp localport=%BACKEND_PORT%
echo.
pause

