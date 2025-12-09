@echo off
:: ===========================================
::  Transmission WBS Task Manager - Launcher
:: ===========================================
::
:: INSTRUCTIONS:
:: 1. Edit the SERVER_IP below to match the host computer's IP address
:: 2. Copy this folder to your network share
:: 3. Users double-click this file to open the app
::

:: === CONFIGURATION ===
set "SERVER_IP=10.93.96.42"
set "SERVER_PORT=3005"
:: =====================

echo Opening Transmission WBS Task Manager...
echo Connecting to http://%SERVER_IP%:%SERVER_PORT%

start "" "http://%SERVER_IP%:%SERVER_PORT%/wbs"

