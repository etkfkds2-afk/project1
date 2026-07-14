@echo off
setlocal
cd /d "%~dp0"

echo.
echo [Allthatmind Reservation Notifier]
echo Showing a test notification...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0test-notifier.ps1"

echo.
pause
